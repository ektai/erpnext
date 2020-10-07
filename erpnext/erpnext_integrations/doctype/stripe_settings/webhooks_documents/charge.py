# -*- coding: utf-8 -*-
# Copyright (c) 2019, Dokos SAS and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json
from frappe.utils import flt

from erpnext.erpnext_integrations.webhooks_controller import WebhooksController

EVENT_MAP = {
	'charge.captured': 'create_payment',
	'charge.expired': 'cancel_payment',
	'charge.failed': 'cancel_payment',
	'charge.pending': 'create_payment',
	'charge.succeeded': 'submit_stripe_payment'
}

class StripeChargeWebhookHandler(WebhooksController):
	def __init__(self, **kwargs):
		super(StripeChargeWebhookHandler, self).__init__(**kwargs)

		self.charge = None
		self.event_map = EVENT_MAP

		self.init_handler()
		self.action_type = self.data.get("type")

		if self.metadata:
			self.handle_payment_update()
			self.add_reference_to_integration_request()
		else:
			self.set_as_failed(_("No metadata found in this webhook"))

	def init_handler(self):
		self.stripe_settings = frappe.get_doc("Stripe Settings", self.integration_request.get("payment_gateway_controller"))
		self.payment_gateway = frappe.db.get_value("Payment Gateway",\
			dict(gateway_settings="Stripe Settings", gateway_controller=self.integration_request.get("payment_gateway_controller")))

		self.get_charge()
		self.get_invoice()
		self.get_metadata()

	def get_charge(self):
		charge_id = self.data.get("data", {}).get("object", {}).get("id")
		self.charge = self.stripe_settings.get_charge_on_stripe(charge_id)

	def get_invoice(self):
		self.stripe_invoice = self.stripe_settings.stripe.Invoice.retrieve(
			self.charge.get("invoice")
		)

	def get_metadata(self):
		self.metadata = getattr(self.charge, "metadata")

		if not self.metadata:
			self.stripe_subscription = self.stripe_settings.stripe.Subscription.retrieve(
				self.stripe_invoice.get("subscription")
			)
			self.metadata = getattr(self.stripe_subscription, "metadata")

	def add_fees_before_submission(self):
		if self.charge:
			self.integration_request.db_set("output", json.dumps(self.charge, indent=4))
			self.base_amount = self.stripe_settings.get_base_amount(self.charge)
			self.exchange_rate = self.stripe_settings.get_exchange_rate(self.charge)
			self.fee_amount = self.stripe_settings.get_fee_amount(self.charge)

			#TODO: Commonify with payment request
			gateway_defaults = frappe.db.get_value("Payment Gateway", self.payment_gateway,\
				["fee_account", "cost_center", "mode_of_payment"], as_dict=1) or dict()

			self.payment_entry.mode_of_payment = gateway_defaults.get("mode_of_payment")

			if self.exchange_rate:
				self.payment_entry.update({
					"target_exchange_rate": self.exchange_rate,
				})

			if self.fee_amount and gateway_defaults.get("fee_account") and gateway_defaults.get("cost_center"):
				fees = flt(self.fee_amount) * flt(self.payment_entry.get("target_exchange_rate", 1))
				self.payment_entry.update({
					"paid_amount": flt(self.base_amount or self.payment_entry.paid_amount) - fees,
					"received_amount": flt(self.payment_entry.received_amount) - fees
				})

				self.payment_entry.append("deductions", {
					"account": gateway_defaults.get("fee_account"),
					"cost_center": gateway_defaults.get("cost_center"),
					"amount": self.fee_amount
				})

				self.payment_entry.set_amounts()

	def submit_stripe_payment(self):
		if len(frappe.get_all("Integration Request", filters={"service_id": self.integration_request.get("service_id")})) == 1:
			self.create_payment()
			self.submit_payment()
		else:
			self.submit_payment()
