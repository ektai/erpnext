# -*- coding: utf-8 -*-
# Copyright (c) 2019, Dokos SAS and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json
from frappe.utils import flt, getdate

from erpnext.erpnext_integrations.webhooks_controller import WebhooksController

EVENT_MAP = {
	'created': 'create_payment',
	'submitted': 'create_payment',
	'confirmed': 'create_payment',
	'cancelled': 'cancel_payment',
	'failed': 'cancel_payment',
	'paid_out': 'submit_payment'
}

class GoCardlessPaymentWebhookHandler(WebhooksController):
	def __init__(self, **kwargs):
		super(GoCardlessPaymentWebhookHandler, self).__init__(**kwargs)

		self.event_map = EVENT_MAP
		self.gocardless_payment = None
		self.gocardless_payout = None
		self.gocardless_payment_document = {}
		self.init_handler()

		if self.gocardless_payment and self.metadata:
			self.integration_request.db_set("service_id", self.gocardless_payment)
			self.integration_request.load_from_db()

			self.action_type = self.data.get("action")
			self.handle_payment_update()
			self.add_reference_to_integration_request()
		else:
			self.set_as_completed(_("No payment reference and metadata found in this webhook"))

	def init_handler(self):
		self.gocardless_settings = frappe.get_doc("GoCardless Settings", self.integration_request.get("payment_gateway_controller"))
		self.payment_gateway = frappe.db.get_value("Payment Gateway",\
			dict(gateway_settings="GoCardless Settings", gateway_controller=self.integration_request.get("payment_gateway_controller")))

		self.get_payment()
		self.get_payment_document()
		self.get_reference_date()
		self.get_metadata()

	def get_customer(self):
		return self.data.get("links", {}).get("customer")

	def get_payment(self):
		self.gocardless_payment = self.data.get("links", {}).get("payment")

	def get_reference_date(self):
		self.reference_date = getdate(getattr(self.gocardless_payment_document, "charge_date"))

	def get_payment_document(self):
		self.gocardless_payment_document = self.gocardless_settings.get_payments_on_gocardless(id=self.gocardless_payment) if self.gocardless_payment else {}

	def get_payout(self):
		self.gocardless_payout = self.data.get("links", {}).get("payout") or getattr(getattr(self.gocardless_payment_document, "links"), "payout")

	def get_metadata(self):
		self.metadata = getattr(self.gocardless_payment_document, "metadata")

	def add_fees_before_submission(self):
		self.get_payout()
		if self.gocardless_payout:
			payout_items = self.gocardless_settings.get_payout_items_list({"payout": self.gocardless_payout})

			output = ""
			for p in payout_items:
				output += str(p.__dict__)
			self.integration_request.db_set("output", output)

			self.base_amount = self.gocardless_settings.get_base_amount(payout_items, self.gocardless_payment)
			self.fee_amount = self.gocardless_settings.get_fee_amount(payout_items, self.gocardless_payment)
			#TODO: Handle exchange rates
			# self.exchange_rate = self.gocardless_settings.get_exchange_rate(payout)

			#TODO: Commonify with payment request
			gateway_defaults = frappe.db.get_value("Payment Gateway", self.payment_gateway,\
				["fee_account", "cost_center", "mode_of_payment"], as_dict=1) or dict()

			self.payment_entry.mode_of_payment = gateway_defaults.get("mode_of_payment")

			#TODO: Handle exchange rates
			# if self.exchange_rate:
			#	self.payment_entry.update({
			#		"target_exchange_rate": self.exchange_rate,
			#	})

			if self.fee_amount and gateway_defaults.get("fee_account") and gateway_defaults.get("cost_center"):
				fees = flt(self.fee_amount) * flt(self.payment_entry.get("target_exchange_rate", 1))
				self.payment_entry.update({
					"paid_amount": flt(self.base_amount or self.payment_entry.paid_amount) + fees,
					"received_amount": flt(self.payment_entry.received_amount) + fees,
					"mode_of_payment": gateway_defaults.get("mode_of_payment")
				})

				self.payment_entry.append("deductions", {
					"account": gateway_defaults.get("fee_account"),
					"cost_center": gateway_defaults.get("cost_center"),
					"amount": -1 * self.fee_amount
				})

				self.payment_entry.set_amounts()
