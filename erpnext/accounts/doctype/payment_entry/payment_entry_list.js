// Copyright (c) 2019, Dokos SAS and Contributors
// License: See license.txt

frappe.listview_settings['Payment Entry'] = {
	get_indicator: function(doc) {
		if (doc.docstatus == 1 && doc.unreconciled_amount > 0) {
			return [__("Unreconciled"), "orange", "status,==,Unreconciled"];
		} else if(doc.docstatus == 1 && doc.unreconciled_amount <= 0) {
			return [__("Reconciled"), "green", "status,==,Reconciled"];
		}
	}
};