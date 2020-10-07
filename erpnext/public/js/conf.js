// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt

frappe.provide('erpnext');

// add toolbar icon
$(document).bind('toolbar_setup', function() {
	frappe.app.name = "dokos";

	frappe.help_feedback_link = '<p><a class="text-muted" \
		href="https://discuss.erpnext.com">Feedback</a></p>'

	$('[data-link="docs"]').attr("href", "https://doc.ektai.io")
	$('[data-link="issues"]').attr("href", "https://gitlab.com/ektai/dokos/issues")



	// additional help links for erpnext
	var $help_menu = $('.dropdown-help ul .documentation-links');
	$('<li><a data-link-type="doc" href="https://doc.ektai.io" \
		target="_blank">'+__('Documentation')+'</a></li>').insertBefore($help_menu);
	$('<li><a data-link-type="doc" href="https://community.ektai.io" \
		target="_blank">'+__('Community')+'</a></li>').insertBefore($help_menu);
	$('<li><a href="https://gitlab.com/ektai/dokos/issues" \
		target="_blank">'+__('Report an Issue')+'</a></li>').insertBefore($help_menu);

});

// preferred modules for breadcrumbs
$.extend(frappe.breadcrumbs.preferred, {
	"Item Group": "Stock",
	"Customer Group": "Selling",
	"Supplier Group": "Buying",
	"Territory": "Selling",
	"Sales Person": "Selling",
	"Sales Partner": "Selling",
	"Brand": "Selling"
});

$.extend(frappe.breadcrumbs.module_map, {
	'ERPNext Integrations': 'Integrations',
	'Geo': 'Settings',
	'Accounts': 'Accounting',
	'Portal': 'Website',
	'Utilities': 'Settings',
	'Shopping Cart': 'Website',
	'Contacts': 'CRM'
});
