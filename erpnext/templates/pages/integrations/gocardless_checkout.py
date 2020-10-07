# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt
from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import flt, fmt_money
import json
from frappe.integrations.utils import get_gateway_controller
from frappe.utils import get_url

EXPECTED_KEYS = ('amount', 'title', 'description', 'reference_doctype', 'reference_docname',\
	'payer_name', 'payer_email', 'order_id', 'currency')

def get_context(context):
	context.no_cache = 1

	# all these keys exist in form_dict
	if not set(EXPECTED_KEYS) - set(frappe.form_dict.keys()):
		for key in EXPECTED_KEYS:
			context[key] = frappe.form_dict[key]

		context['amount'] = flt(context['amount'])

		gateway_controller = get_gateway_controller(context.reference_doctype, context.reference_docname)

	else:
		frappe.redirect_to_message(_('Invalid link'),\
			_('This link is not valid.<br>Please contact us.'))
		frappe.local.flags.redirect_location = frappe.local.response.location
		raise frappe.Redirect

@frappe.whitelist(allow_guest=True)
def redirect_to_gocardless(data):
	data = frappe.parse_json(data)

	gateway_controller = get_gateway_controller(data["reference_doctype"], data["reference_docname"])
	client = frappe.get_doc("GoCardless Settings", gateway_controller).initialize_client()

	success_url = data.get("success_url")
	if not success_url:
		success_url = get_url("./integrations/gocardless_confirmation?reference_doctype="\
			+ data["reference_doctype"] + "&reference_docname=" + data["reference_docname"])

	try:
		redirect_flow = client.redirect_flows.create(params={
			"description": _("Pay {0}").format(fmt_money(data['amount'], currency=data['currency'])),
			"session_token": data["reference_docname"],
			"success_redirect_url": success_url,
			"prefilled_customer": get_prefilled_customer(data)
		})

		return {"redirect_to": redirect_flow.redirect_url}

	except Exception as e:
		frappe.log_error(e, "GoCardless Payment Error")
		return {"redirect_to": '/integrations/payment-failed'}

def get_prefilled_customer(data):
	reference = frappe.db.get_value(data["reference_doctype"], data["reference_docname"],\
		["reference_doctype", "reference_name"], as_dict=True)

	if reference.get("reference_doctype") == "Subscription":
		original_transaction = frappe.db.get_value(reference.get("reference_doctype"),\
			reference.get("reference_name"), "customer", as_dict=True)
		original_transaction["customer_address"] = frappe.db.get_value("Customer", original_transaction.get("customer"), "customer_primary_address")
	else:
		original_transaction = frappe.db.get_value(reference.get("reference_doctype"),\
			reference.get("reference_name"), ["customer", "customer_address"], as_dict=True)

	prefilled_customer = get_customer_data(data, original_transaction)
	prefilled_customer = get_billing_address(prefilled_customer, original_transaction)

	return prefilled_customer

def get_customer_data(data, original_transaction):
	customer = frappe.db.get_value("Customer", original_transaction.get("customer"),\
		["customer_name", "customer_type", "customer_primary_contact"], as_dict=True)

	if customer.get("customer_type") == "Individual" and customer.get("customer_primary_contact"):
		primary_contact = frappe.db.get_value("Contact", customer.get("customer_primary_contact"),\
			["first_name", "last_name", "email_id"], as_dict=True)

		return {
			"company_name": customer.get("customer_name"),
			"given_name": primary_contact.get("first_name") or "",
			"family_name": primary_contact.get("last_name") or "",
			"email": primary_contact.get("email_id") or data.get("payer_email") or frappe.session.user
		}

	return {
		"company_name": customer.get("customer_name"),
		"email": data.get("payer_email") or frappe.session.user
	}

def get_billing_address(prefilled_customer, original_transaction):
	if original_transaction.get("customer_address"):
		address = frappe.get_doc("Address", original_transaction.get("customer_address"))
		prefilled_customer.update({
			"address_line1": address.get("address_line1") or "",
			"address_line2": address.get("address_line2") or "",
			"city": address.get("city") or "",
			"postal_code": address.get("pincode") or "",
			"country_code": frappe.db.get_value("Country", address.country, "code") or ""
		})

	return prefilled_customer

