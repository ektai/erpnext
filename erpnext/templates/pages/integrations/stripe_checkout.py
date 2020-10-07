# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt
from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import cint, fmt_money
from frappe.integrations.utils import get_gateway_controller

EXPECTED_KEYS = ('amount', 'title', 'description', 'reference_doctype', 'reference_docname',\
	'payer_name', 'payer_email', 'order_id', 'currency')

def get_context(context):
	context.no_cache = 1
	context.lang = frappe.local.lang

	# all these keys exist in form_dict
	if not set(EXPECTED_KEYS) - set(list(frappe.form_dict)):
		for key in EXPECTED_KEYS:
			context[key] = frappe.form_dict[key]

		context.client_secret = "no-secret"
		context.is_subscription = False
		gateway_controller = get_gateway_controller(context.reference_doctype, context.reference_docname)
		reference_document = frappe.get_doc(context.reference_doctype, context.reference_docname)

		if hasattr(reference_document, 'is_linked_to_a_subscription') and reference_document.is_linked_to_a_subscription():
			context.is_subscription = True
		else:
			payment_intent = frappe.get_doc("Stripe Settings", gateway_controller)\
				.create_payment_intent_on_stripe(amount=cint(context['amount'])*100, currency=context['currency'])

			context.client_secret = payment_intent.client_secret

		context.publishable_key = get_api_key(context.reference_docname, gateway_controller)
		context.image = get_header_image(context.reference_docname, gateway_controller)
		context.amount = fmt_money(amount=context.amount, currency=context.currency)

	else:
		frappe.redirect_to_message(_('Invalid link'),\
			_('This link is not valid.<br>Please contact us.'))
		frappe.local.flags.redirect_location = frappe.local.response.location
		raise frappe.Redirect

def get_api_key(doc, gateway_controller):
	return frappe.db.get_value("Stripe Settings", gateway_controller, "publishable_key")

def get_header_image(doc, gateway_controller):
	return frappe.db.get_value("Stripe Settings", gateway_controller, "header_img")

@frappe.whitelist(allow_guest=True)
def make_payment_intent(data, intent):
	data = frappe.parse_json(data)

	gateway_controller = get_gateway_controller(data["reference_doctype"], data["reference_docname"])
	return frappe.get_doc("Stripe Settings", gateway_controller).create_payment_intent(data, intent)

@frappe.whitelist(allow_guest=True)
def make_subscription(data, stripe_token_id):
	data = frappe.parse_json(data)
	data.update({
		"stripe_token_id": stripe_token_id
	})

	gateway_controller = get_gateway_controller(data["reference_doctype"], data["reference_docname"])
	return frappe.get_doc("Stripe Settings", gateway_controller).create_subscription(data)