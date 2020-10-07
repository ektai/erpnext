# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt
from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.integrations.utils import get_gateway_controller

EXPECTED_KEYS = ('redirect_flow_id', 'reference_doctype', 'reference_docname')

def get_context(context):
	context.no_cache = 1

	# all these keys exist in form_dict
	if not (set(EXPECTED_KEYS) - set(frappe.form_dict.keys())):
		for key in EXPECTED_KEYS:
			context[key] = frappe.form_dict[key]

	else:
		frappe.redirect_to_message(_('Invalid link'),\
			_('This link is not valid.<br>Please contact us.'))
		frappe.local.flags.redirect_location = frappe.local.response.location
		raise frappe.Redirect

@frappe.whitelist(allow_guest=True)
def confirm_payment(redirect_flow_id, reference_doctype, reference_docname):

	gateway_controller = get_gateway_controller(reference_doctype, reference_docname)
	settings = frappe.get_doc("GoCardless Settings", gateway_controller)
	client = settings.initialize_client()

	try:
		redirect_flow = client.redirect_flows.complete(
			redirect_flow_id,
			params={
				"session_token": reference_docname
			}
		)

		confirmation_url = frappe.utils.get_url('/integrations/payment-success')
		gocardless_success_page = frappe.get_hooks('gocardless_success_page')
		if gocardless_success_page:
			confirmation_url = frappe.get_attr(gocardless_success_page[-1])\
				(reference_doctype, reference_docname)

		data = {
			"mandate": redirect_flow.links.mandate,
			"customer": redirect_flow.links.customer,
			"redirect_to": confirmation_url,
			"redirect_message": "Mandate successfully created",
			"reference_doctype": reference_doctype,
			"reference_docname": reference_docname
		}

		create_mandate(data)
		return settings.create_payment_request(data)

	except Exception as e:
		frappe.log_error(e, "GoCardless Payment Error")
		return {"redirect_to": '/integrations/payment-failed'}


def create_mandate(data):
	data = frappe._dict(data)

	if not frappe.db.exists("Sepa Mandate", data.get('mandate')):
		try:
			reference_doc = frappe.db.get_value(data.get('reference_doctype'), data.get('reference_docname'),\
				["reference_doctype", "reference_name", "payment_gateway"], as_dict=1)
			origin_transaction = frappe.db.get_value(reference_doc.reference_doctype, reference_doc.reference_name,\
				["customer"], as_dict=1)

			frappe.get_doc({
				"doctype": "Sepa Mandate",
				"mandate": data.get('mandate'),
				"customer": origin_transaction.get("customer"),
				"registered_on_gocardless": 1
			}).insert(ignore_permissions=True)

			add_gocardless_customer_id(reference_doc, data.get('customer'))

		except Exception as e:
			frappe.log_error(e, "Sepa Mandate Registration Error")

def add_gocardless_customer_id(reference_doc, customer_id):
	origin_transaction = frappe.db.get_value(reference_doc.reference_doctype,\
		reference_doc.reference_name, ["customer"], as_dict=1)

	try:
		if frappe.db.exists("Integration References", dict(customer=origin_transaction.get("customer"))):
			doc = frappe.get_doc("Integration References", dict(customer=origin_transaction.get("customer")))
			doc.gocardless_customer_id = customer_id
			doc.gocardless_settings = frappe.db.get_value("Payment Gateway", reference_doc.get("payment_gateway"), "gateway_controller")
			doc.save(ignore_permissions=True)

		else:
			frappe.get_doc({
				"doctype": "Integration References",
				"customer": origin_transaction.get("customer"),
				"gocardless_customer_id": customer_id,
				"gocardless_settings": frappe.db.get_value("Payment Gateway", reference_doc.get("payment_gateway"), "gateway_controller")
			}).insert(ignore_permissions=True)
	except Exception as e:
		frappe.log_error(e, "GoCardless Customer ID Registration Error")
