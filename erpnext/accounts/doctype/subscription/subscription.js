// Copyright (c) 2018, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.ui.form.on('Subscription', {
	setup: function(frm) {
		frm.trigger('setup_listeners');

		frm.set_indicator_formatter('item', function(doc) {
			return (doc.status == "Active") ? "green" : "darkgrey";
		});

		frm.make_methods = {
			'Payment Request': () => {
				frappe.call({
					method: "erpnext.accounts.doctype.payment_request.payment_request.make_payment_request",
					freeze: true,
					args: {
						dt: me.frm.doc.doctype,
						dn: me.frm.doc.name,
						party_type: "Customer",
						party: me.frm.doc.customer
					}
				}).then(r => {
					if (r.message) {
						const doc = frappe.model.sync(r.message)[0];
						frappe.set_route("Form", doc.doctype, doc.name);
					}
				});
			}
		}

		frm.set_query('uom', 'plans', function(doc, cdt, cdn) {
			const row = locals[cdt][cdn];
			return {
				query:"erpnext.accounts.doctype.pricing_rule.pricing_rule.get_item_uoms",
				filters: {value: row.item, apply_on: 'Item Code'}
			}
		});
	},
	refresh: function(frm) {
		frm.page.clear_actions_menu();
		if(!frm.is_new()){
			frm.page.add_action_item(
				__('Create payment'),
				() => frm.events.create_payment(frm)
			);
			if(frm.doc.status !== 'Cancelled'){
				if(!frm.doc.cancellation_date){
					frm.page.add_action_item(
						__('Cancel Subscription'),
						() => frm.events.cancel_this_subscription(frm)
					);
				} else {
					frm.page.add_action_item(
						__('Do not cancel this subscription'),
						() => frm.events.abort_cancel_this_subscription(frm)
					);
				}
				frm.page.add_action_item(
					__('Fetch Subscription Updates'),
					() => frm.events.get_subscription_updates(frm)
				);

			}
			else if(frm.doc.status === 'Cancelled'){
				frm.page.add_action_item(
					__('Restart Subscription'),
					() => frm.events.renew_this_subscription(frm)
				);
			}

			frappe.xcall("erpnext.accounts.doctype.subscription.subscription.subscription_headline", {
				'name': frm.doc.name
			})
			.then(r => {
				frm.dashboard.clear_headline();
				frm.dashboard.set_headline_alert(r);
			})
		}
		frm.set_value("company", frappe.defaults.get_user_default("Company"));
	},

	cancel_this_subscription: function(frm) {
		let fields = [
			{
				"fieldtype": "Date",
				"label": __("Cancellation date"),
				"fieldname": "cancellation_date",
			},
			{
				"fieldtype": "Check",
				"label": __("Prorate last invoice"),
				"fieldname": "prorate_invoice"
			}
		]

		const dialog = new frappe.ui.Dialog({
			title: __("Cancel subscription"),
			fields: fields,
			primary_action: function() {
				const values = dialog.get_values();
				values["name"] = frm.doc.name
				dialog.hide()
				frappe.call({
					method:
					"erpnext.accounts.doctype.subscription.subscription.cancel_subscription",
					args: values,
					callback: function(data){
						if(!data.exc){
							frm.reload_doc();
						}
					}
				});
			}
		})
		dialog.show()
	},

	abort_cancel_this_subscription: function(frm) {
		frappe.call({
			method:
			"erpnext.accounts.doctype.subscription.subscription.cancel_subscription",
			args: {
				cancellation_date: null,
				prorate_invoice: 0,
				name: frm.doc.name
			},
			callback: function(data){
				if(!data.exc){
					frm.reload_doc();
				}
			}
		});
	},

	renew_this_subscription: function(frm) {
		const doc = frm.doc;
		frappe.confirm(
			__('Are you sure you want to restart this subscription?'),
			function() {
				frappe.call({
					method:
					"erpnext.accounts.doctype.subscription.subscription.restart_subscription",
					args: {name: doc.name},
					callback: function(data){
						if(!data.exc){
							frm.reload_doc();
						}
					}
				});
			}
		);
	},

	get_subscription_updates: function(frm) {
		const doc = frm.doc;
		frappe.call({
			method:
			"erpnext.accounts.doctype.subscription.subscription.get_subscription_updates",
			args: {name: doc.name},
			freeze: true,
			callback: function(data){
				if(!data.exc){
					frm.reload_doc();
				}
			}
		});
	},

	setup_listeners: function(frm) {
		frappe.realtime.on('payment_gateway_updated', (data) => {
			const format_values = value => {
				return format_currency(value / 100, frm.doc.currency)
			}
			if (data.initial_amount && data.updated_amount) {
				frappe.show_alert({message: __("Payment gateway subscription amount updated from {0} to {1}",
					[format_values(data.initial_amount), format_values(data.updated_amount)]), indicator: 'green'})
			}
		})
	},
	create_payment(frm) {
		return frappe.call({
			method: "erpnext.accounts.doctype.subscription.subscription.get_payment_entry",
			args: {
				"name": frm.doc.name
			}
		}).then(r => {
			const doclist = frappe.model.sync(r.message);
			frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
		});
	},
	subscription_plan(frm) {
		if (frm.doc.subscription_plan) {
			frappe.model.with_doc("Subscription Plan", frm.doc.subscription_plan, function() {
				const plan = frappe.get_doc("Subscription Plan", frm.doc.subscription_plan);
				frm.doc.plans.push.apply(frm.doc.plans, plan.subscription_plans_template);
				frm.refresh_field("plans");
			})
		}
	}
});

frappe.ui.form.on('Subscription Plan Detail', {
	item: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn]
		frappe.db.get_value("Item", row.item, "description", r => {
			if (r&&r.description) {
				frappe.model.set_value(cdt, cdn, "description", r.description);
			}
		})
	}
})