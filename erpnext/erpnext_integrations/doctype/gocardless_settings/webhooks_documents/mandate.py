# -*- coding: utf-8 -*-
# Copyright (c) 2019, Dokos SAS and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json
from erpnext.erpnext_integrations.webhooks_controller import WebhooksController

EVENT_MAP = {
	'customer_approval_granted': 'change_status',
	'customer_approval_skipped': 'change_status',
	'active': 'change_status',
	'cancelled': 'change_status',
	'failed': 'change_status',
	'transferred': 'change_status',
	'expired': 'change_status',
	'submitted': 'change_status',
	'resubmission_requested': 'change_status',
	'reinstated': 'change_status',
	'replaced': 'change_status'
}

STATUS_MAP = {
	'customer_approval_granted': 'Pending Customer Approval',
	'customer_approval_skipped': 'Pending Submission',
	'active': 'Active',
	'cancelled': 'Cancelled',
	'failed': 'Failed',
	'transferred': 'Submitted',
	'expired': 'Expired',
	'submitted': 'Submitted',
	'resubmission_requested': 'Pending Submission',
	'reinstated': 'Active',
	'replaced': 'Cancelled'
}

class GoCardlessMandateWebhookHandler(WebhooksController):
	def __init__(self, **kwargs):
		super(GoCardlessMandateWebhookHandler, self).__init__(**kwargs)

		self.get_mandate()
		target = EVENT_MAP.get(self.data.get("action"))
		if not target:
			self.integration_request.db_set("error", _("This type of event is not handled by dokos"))
			self.integration_request.update_status({}, "Not Handled")

		else:
			method = getattr(self, target)
			method()

		self.add_mandate_to_integration_request()

	def get_mandate(self):
		self.mandate = self.data.get("links", {}).get("mandate")

	def create_mandates(self):
		mandate_exists = self.check_existing_mandate()
		if mandate_exists:
			self.set_status(self.mandate, STATUS_MAP.get(self.data.get("action")))
		else:
			#TODO: Handle mandate creation through API (only for GoCardless Pro accounts)
			self.integration_request.update_status({}, "Completed")

	def check_existing_mandate(self):
		return False if frappe.db.exists("Sepa Mandate", dict(mandate=mandate)) else True

	def change_status(self):
		self.set_status(self.mandate, STATUS_MAP.get(self.data.get("action")))

	def set_status(self, mandate, status):
		try:
			frappe.db.set_value("Sepa Mandate", mandate, "status", status)
			self.integration_request.update_status({}, "Completed")
		except Exception as e:
			self.integration_request.db_set("error", str(e))
			self.integration_request.update_status({}, "Failed")

	def add_mandate_to_integration_request(self):
		self.integration_request.db_set("reference_doctype", "Sepa Mandate")
		self.integration_request.db_set("reference_docname", self.mandate)
