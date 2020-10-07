// Copyright (c) 2019, Dokos SAS and Contributors
// License: See license.txt
frappe.provide("erpnext.accounts");

frappe.listview_settings['Bank Transaction'] = {
	add_fields: ["unallocated_amount"],
	get_indicator: function(doc) {
		if(flt(doc.unallocated_amount)!=0) {
			return [__("Unreconciled"), "orange", "unallocated_amount,>,0"];
		} else if(flt(doc.unallocated_amount)==0) {
			return [__("Reconciled"), "green", "unallocated_amount,=,0"];
		}
	},
	onload: function(list_view) {
		frappe.require('assets/js/bank-transaction-importer.min.js', function() {
			frappe.db.get_value("Plaid Settings", "Plaid Settings", "enabled", (r) => {
				if (r && r.enabled == "1") {
					list_view.page.add_menu_item(__("Synchronize this account"), function() {
						new erpnext.accounts.bankTransactionUpload('plaid');
					});
				}
			})
			list_view.page.add_menu_item(__("Upload an ofx statement"), function() {
				new erpnext.accounts.bankTransactionUpload('ofx');
			});
			list_view.page.add_menu_item(__("Upload a csv/xlsx statement"), function() {
				new erpnext.accounts.bankTransactionUpload('csv');
			});
		});
	},
	on_update: function(list_view) {
		list_view.refresh()
	}
};