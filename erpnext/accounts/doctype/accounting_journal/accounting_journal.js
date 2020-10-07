// Copyright (c) 2019, Dokos SAS and Contributors
// For license information, please see license.txt

frappe.ui.form.on('Accounting Journal', {
});

frappe.ui.form.on('Accounting Journal Rule', {
	document_type: function(frm, cdt, cdn) {
		let d = locals[cdt][cdn];
		if (d.document_type) {
			frappe.call({
				method: "erpnext.accounts.doctype.accounting_journal.accounting_journal.get_prefixes",
				args: {
					doctype: d.document_type
				},
				callback: function(r) {
					let df = frappe.meta.get_docfield("Accounting Journal Rule","default_naming_series", frm.doc.name);
					df.options = r.message;
					refresh_field("default_naming_series", d.name, "conditions");
				}
			});
		}
	}
});
