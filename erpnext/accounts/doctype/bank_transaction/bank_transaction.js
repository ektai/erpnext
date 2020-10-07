// Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Bank Transaction', {
	onload(frm) {
		frm.set_query('payment_document', 'payment_entries', function() {
			return {
				"filters": {
					"name": ["in", ["Payment Entry", "Journal Entry", "Sales Invoice", "Purchase Invoice", "Expense Claim"]]
				}
			};
		});

		frm.set_query('payment_entry', 'payment_entries', function(doc, cdt, cdn) {
			const row  = locals[cdt][cdn];
			const filters = {
				"filters": {
					"unreconciled_amount": [">", 0]
				}
			};

			if (["Sales Invoice", "Purchase Invoice"].includes(row.payment_document)) {
				return {...filters,
					currency: frm.doc.currency,
					is_paid: 1
				}
			} else if (row.payment_document == "Expense Claim") {
				return {...filters,
					is_paid: 1
				}
			} else if (row.payment_document == "Payment Entry") {
				if ((frm.doc.credit - frm.doc.debit) < 0) {
					return {...filters,
						paid_from_account_currency: frm.doc.currency
					}
				} else {
					return {...filters,
						paid_to_account_currency: frm.doc.currency
					}
				}
			}
		});
	},
	refresh(frm) {
		frm.page.clear_actions_menu();
		if (frm.doc.docstatus == 1 && frm.doc.unallocated_amount > 0) {
			frm.page.add_action_item(__('Make payment entry'), function() {
				make_new_doc(frm.doc, "Payment Entry");			
			});
		}
	}
});

frappe.ui.form.on('Bank Transaction Payments', {
	payment_entry: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (row.payment_document && row.payment_entry) {
			frappe.db.get_value(row.payment_document, row.payment_entry, "unreconciled_amount", r => {
				const amount = (Math.abs(r.unreconciled_amount) >= Math.abs(frm.doc.unallocated_amount)) ? Math.abs(frm.doc.unallocated_amount) : Math.abs(r.unreconciled_amount)
				frappe.model.set_value(cdt, cdn, "allocated_amount", amount);
			})

			switch(row.payment_document) {
				case "Sales Invoice":
					frappe.db.get_value(row.payment_document, row.payment_entry, ["is_return", "customer", "due_date"], r => {
						frappe.model.set_value(cdt, cdn, "payment_type", r.is_return ? "Credit": "Debit");
					});
					break;
				case "Purchase Invoice":
					frappe.db.get_value(row.payment_document, row.payment_entry, ["is_return", "supplier", "due_date"], r => {
						frappe.model.set_value(cdt, cdn, "payment_type", r.is_return ? "Debit": "Credit");
					});
					break;
				case "Payment Entry":
					frappe.db.get_value(row.payment_document, row.payment_entry, ["payment_type", "party", "posting_date"], r => {
						frappe.model.set_value(cdt, cdn, "payment_type", r.payment_type == "Receive" ? "Debit": "Credit");
					});
					break;
				case "Journal Entry":
					if (frm.doc.bank_account) {
						frappe.db.get_value("Bank Account", frm.doc.bank_account, "account", r => {
							frappe.db.get_value("Journal Entry Account", {parent: row.payment_entry, account: r.account}, "debit_in_account_currency", (value) => {
								value&&value.debit_in_account_currency&&frappe.model.set_value(cdt, cdn, "payment_type", value.debit_in_account_currency == 0 ? "Credit" : "Debit");
							}, 'Journal Entry');

							frappe.db.get_value("Journal Entry Account", {parent: row.payment_entry, account: ["!=", r.account]}, "party", (value) => {
								value&&value.party&&frappe.model.set_value(cdt, cdn, "party", value.party);
							}, 'Journal Entry');
						})

						frappe.db.get_value("Journal Entry", row.payment_entry, "posting_date", (value) => {
							value&&value.posting_date&&frappe.model.set_value(cdt, cdn, "date", value.posting_date);
						});
					}
					break;
				default:
					frappe.model.set_value(cdt, cdn, "payment_type", "Credit");
					break;
			}
		}
	}
});

const make_new_doc = (doc, doctype) => {
	frappe.xcall('erpnext.accounts.doctype.bank_transaction.bank_transaction.make_new_document',{
		document_type: doctype,
		transactions: [{...doc, amount: doc.credit > 0 ? doc.credit: -doc.debit}]
	}).then(r => {
		const doclist = frappe.model.sync(r);
		frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
	})
}