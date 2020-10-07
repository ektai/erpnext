frappe.ui.form.on("Payment Request", {
	setup(frm) {
		frm.add_fetch("payment_gateway_account", "payment_account", "payment_account")
		frm.add_fetch("payment_gateway_account", "payment_gateway", "payment_gateway")
		frm.add_fetch("payment_gateways_template", "email_template", "email_template")

		frm.set_query("party_type", function() {
			return {
				query: "erpnext.setup.doctype.party_type.party_type.get_party_type",
			};
		});
	},
	onload(frm) {
		if (frm.doc.reference_doctype) {
			frappe.call({
				method:"erpnext.accounts.doctype.payment_request.payment_request.get_print_format_list",
				args: {"ref_doctype": frm.doc.reference_doctype},
				callback:function(r){
					set_field_options("print_format", r.message["print_format"])
				}
			})
		}
	},
	validate(frm) {
		if (frm.subscription_doc && !frm.date_confirmation) {
			if (frm.subscription_doc.generate_invoice_at_period_start && frm.subscription_doc.current_invoice_start !== frm.doc.transaction_date) {
				frappe.show_alert ({
					message: __('Warning: The transaction date is different from the subscription current invoice start.'),
					indicator: 'orange'
				});
			} else if (!frm.subscription_doc.generate_invoice_at_period_start && frm.subscription_doc.current_invoice_end !== frm.doc.transaction_date) {
				frappe.show_alert ({
					message: __('Warning: The transaction date is different from the subscription current invoice end.'),
					indicator: 'orange'
				});
			}
		}
	},
	refresh(frm) {
		frm.trigger('get_subscription_link');

		if (frm.doc.docstatus === 1 && frm.doc.payment_key) {
			frm.web_link && frm.web_link.remove();
			frm.add_web_link(`/payments?link=${frm.doc.payment_key}`, __("See payment link"));
		}

		if(frm.doc.status !== "Paid" && frm.doc.docstatus==1 && frm.doc.message && !frm.doc.mute_email && frm.doc.email_to){
			frm.add_custom_button(__('Resend Payment Email'), function(){
				frappe.call({
					method: "erpnext.accounts.doctype.payment_request.payment_request.resend_payment_email",
					args: {"docname": frm.doc.name},
					freeze: true,
					freeze_message: __("Sending"),
					callback: function(r){
						if(!r.exc) {
							frappe.msgprint(__("Message Sent"));
						}
					}
				});
			}, __("Actions"));
		}

		if(frm.doc.status == "Initiated") {
			if (!frm.doc.payment_gateway_account) {
				frm.add_custom_button(__('Create Payment Entry'), function(){
					frappe.call({
						method: "erpnext.accounts.doctype.payment_request.payment_request.make_payment_entry",
						args: {"docname": frm.doc.name},
						freeze: true,
						callback: function(r){
							if(!r.exc) {
								var doc = frappe.model.sync(r.message);
								frappe.set_route("Form", r.message.doctype, r.message.name);
							}
						}
					});
				}).addClass("btn-primary");
			}

			if (!frm.doc.payment_gateway || frm.doc.payment_gateway_account.toLowerCase().includes("gocardless")) {
				frappe.call({
					method: "check_if_immediate_payment_is_autorized",
					doc: frm.doc,
				}).then(r => {
					if (r.message && r.message.length) {
						frm.trigger("process_payment_immediately");
					}
				})
			}
		}
	},
	process_payment_immediately(frm) {
		frm.add_custom_button(__('Process payment immediately'), function(){
			frappe.call({
				method: "process_payment_immediately",
				doc: frm.doc,
			}).then(r => {
					frm.reload_doc()
					frappe.show_alert({message:__("Payment successfully initialized"), indicator:'green'});
			})
		}, __("Actions"))
	},
	reference_doctype(frm) {
		frm.trigger('get_subscription_link');
		frm.trigger('get_reference_amount');
	},
	reference_name(frm) {
		frm.trigger('get_subscription_link');
		frm.trigger('get_reference_amount');
	},
	email_template(frm) {
		if (frm.doc.email_template) {
			frappe.xcall('erpnext.accounts.doctype.payment_request.payment_request.get_message', {
				doc: frm.doc,
				template: frm.doc.email_template
			}).then(r => {
				let signature = frappe.boot.user.email_signature || "";

				if(!frappe.utils.is_html(signature)) {
					signature = signature.replace(/\n/g, "<br>");
				}

				if(r.message && signature && r.message.includes(signature)) {
					signature = "";
				}
		
				const content = (r.message || "") + (signature ? ("<br>" + signature) : "");

				frm.set_value("subject", r.subject);
				frm.set_value("message", content);
			})
		}
	},
	payment_gateways_template(frm) {
		if(frm.doc.payment_gateways_template) {
			frappe.model.with_doc("Portal Payment Gateways Template", frm.doc.payment_gateways_template, function() {
				const template = frappe.get_doc("Portal Payment Gateways Template", frm.doc.payment_gateways_template)
				frm.set_value('payment_gateways', template.payment_gateways.slice());
			});
		}
	},
	get_subscription_link(frm) {
		frm.dashboard.clear_headline();
		if (frm.doc.reference_doctype && frm.doc.reference_name) {
			frappe.call({
				method: "is_linked_to_a_subscription",
				doc: frm.doc
			}).done((r) => {
				frm.dashboard.clear_headline();
				if (r && r.message) {
					frm.dashboard.set_headline(__('This payment request is linked to subscription <a href="/desk#Form/Subscription/{0}">{0}</a>', [r.message]));
					frm.toggle_display("payment_gateways_template", false);
					frm.trigger("get_subscription_details");
					frm.fields_dict.transaction_date.df.description = __("Start date for the payment gateway subscription");
					frm.refresh_field('transaction_date');
				} else {
					frm.toggle_display("payment_gateways_template", true);
					frm.fields_dict.transaction_date.df.description = null;
					frm.refresh_field('transaction_date');
				}
			})
		}
	},
	get_reference_amount(frm) {
		if (frm.doc.reference_doctype && frm.doc.reference_name) {
			frappe.xcall('erpnext.accounts.doctype.payment_request.payment_request.get_reference_amount', {
				doctype: frm.doc.reference_doctype,
				docname: frm.doc.reference_name
			}).then(r => {
				r&&frm.set_value("grand_total", r);
				frm.refresh_fields("grand_total");
			})
		}
	},
	get_subscription_details(frm) {
		if (!frm.get_subscription_details_call) {
			frm.get_subscription_details_call = true;
			frappe.call({
				method: "get_linked_subscription",
				doc: frm.doc
			}).done((r) => {
				if (r && r.message) {
					frm.subscription_doc = r.message;
					if (frm.subscription_doc.generate_invoice_at_period_start) {
						frm.dashboard.set_headline(
							__('This subscription invoicing period starts on {0}.',
							[frappe.datetime.global_date_format(frm.subscription_doc.current_invoice_start)]));
					} else {
						frm.dashboard.set_headline(
							__('This subscription invoicing period ends on {0}.',
							[frappe.datetime.global_date_format(frm.subscription_doc.current_invoice_end)]));
					}
					
				}
				frm.get_subscription_details_call = false;
			})
		}
	}

})
