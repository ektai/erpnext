import BankReconciliation from './BankReconciliation.vue';
frappe.provide("erpnext.bank_reconciliation")

erpnext.accounts.bankReconciliationPage = class BankReconciliationPage {
	constructor(wrapper) {
		this.page = frappe.ui.make_app_page({
			parent: wrapper,
			title: __("Bank Reconciliation"),
			single_column: true
		});
		this.parent = wrapper;
		this.page = this.parent.page;

		this.company = frappe.defaults.get_user_default("Company");
		this.bank_account = frappe.boot.sysdefaults.default_bank_account_name;
        this.date_range = [frappe.datetime.add_months(frappe.datetime.get_today(),-1), frappe.datetime.get_today()];
        frappe.utils.make_event_emitter(erpnext.bank_reconciliation);
        this.make();
	}

	make() {
		const me = this;

		me.$main_section = $(`<div class="reconciliation page-main-content"></div>`).appendTo(me.page.main);

		me.page.add_field({
			fieldtype: 'Link',
			label: __('Company'),
			fieldname: 'company',
			options: "Company",
            default: frappe.defaults.get_user_default("Company"),
            reqd: 1,
			onchange: function() {
				if (this.value) {
					me.company = this.value;
				} else {
					me.company = null;
					me.bank_account = null;
                }
			}
		})

		me.page.add_field({
			fieldtype: 'Link',
			label: __('Bank Account'),
			fieldname: 'bank_account',
			options: "Bank Account",
			default: frappe.boot.sysdefaults.default_bank_account_name,
            reqd: 1,
			get_query: function() {
				if(!me.company) {
					frappe.throw(__("Please select company first"));
					return
				}

				return {
					filters: {
						"company": me.company
					}
				}
			},
			onchange: function() {
				if (this.value) {
					me.bank_account = this.value;
					erpnext.bank_reconciliation.trigger("filter_change", {name: 'bankAccount', value: me.bank_account})
				} else {
					me.bank_account = null;
                }
			}
        })

        me.page.add_field({
			fieldtype: 'DateRange',
			label: __('Date Range'),
			fieldname: 'date_range',
            default: [frappe.datetime.add_months(frappe.datetime.get_today(),-1), frappe.datetime.get_today()],
            reqd: 1,
			onchange: function() {
				if (this.value) {
					me.date_range = this.value;
					erpnext.bank_reconciliation.trigger("filter_change", {name: 'dateRange', value: me.date_range})
				} else {
					me.date_range = null;
				}
			}
		})
		
		this.make_reconciliation_tool();
	}

	make_reconciliation_tool() {
		new Vue({
			el: this.$main_section[0],
			render: h => h(BankReconciliation, {
				props: { bank_account: this.bank_account, date_range: this.date_range }
			})
		})
	}
}