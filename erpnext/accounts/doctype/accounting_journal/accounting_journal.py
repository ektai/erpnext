# -*- coding: utf-8 -*-
# Copyright (c) 2019, Dokos SAS and Contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.permissions import get_doctypes_with_read
import json
from frappe import _
from frappe.email.doctype.notification.notification import get_context

class AccountingJournal(Document):
	def validate(self):
		if self.conditions:
			self.validate_conditions()

	def validate_conditions(self):
		for condition in self.conditions:
			temp_doc = frappe.new_doc(condition.document_type)
			try:
				frappe.safe_eval(condition.condition, None, get_context(temp_doc))
			except Exception:
				frappe.throw(_("The Condition '{0}' is invalid").format(condition))

@frappe.whitelist()
def get_prefixes(doctype):
	options = ""
	prefixes = ""
	try:
		options = get_options(doctype)
	except frappe.DoesNotExistError:
		frappe.msgprint(_('Unable to find DocType {0}').format(doctype))

	if options:
		prefixes = prefixes + "\n" + options
	prefixes.replace("\n\n", "\n")
	prefixes = prefixes.split("\n")

	custom_prefixes = frappe.get_all('DocType', fields=["autoname"],\
		filters={"name": ('=', doctype), "autoname":('like', '%.#%'),\
		'module': ('not in', ['Core'])})
	if custom_prefixes:
		prefixes = prefixes + [d.autoname.rsplit('.', 1)[0] for d in custom_prefixes]

	prefixes = "\n".join(sorted(prefixes))

	return  prefixes

def get_options(arg=None):
	if frappe.get_meta(arg).get_field("naming_series"):
		return frappe.get_meta(arg).get_field("naming_series").options
