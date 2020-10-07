# Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals

import frappe
import os
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def setup(company=None, patch=True):
	if not patch:
		update_address_template()
		make_custom_fields()
		add_custom_roles_for_reports()

def make_custom_fields():
	custom_fields = {
		'Company': [
			dict(fieldname='siren_number', label='SIREN Number',
			fieldtype='Data', insert_after='website')
		]
	}

	create_custom_fields(custom_fields)

def add_custom_roles_for_reports():
	report_name = 'Fichier des Ecritures Comptables [FEC]'

	if not frappe.db.get_value('Custom Role', dict(report=report_name)):
		frappe.get_doc(dict(
			doctype='Custom Role',
			report=report_name,
			roles= [
				dict(role='Accounts Manager')
			]
		)).insert()

def update_address_template():
	"""
	Read address template from file. Update existing Address Template or create a
	new one.
	"""
	dir_name = os.path.dirname(__file__)
	template_path = os.path.join(dir_name, 'address_template.html')

	with open(template_path, 'r') as template_file:
		template_html = template_file.read()

	address_template = frappe.db.get_value('Address Template', 'France')

	if address_template:
		frappe.db.set_value('Address Template', 'France', 'template', template_html)
	else:
		# make new html template for France
		frappe.get_doc(dict(
			doctype='Address Template',
			country='France',
			template=template_html
		)).insert()
