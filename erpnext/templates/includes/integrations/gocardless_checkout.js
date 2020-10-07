$(document).ready(function() {
	const data = {{ frappe.form_dict | json }};

	frappe.call({
		method: "erpnext.templates.pages.integrations.gocardless_checkout.redirect_to_gocardless",
		freeze: true,
		headers: {
			"X-Requested-With": "XMLHttpRequest"
		},
		args: {
			"data": JSON.stringify(data)
		}
	}).then(r => {
		if (r.message) {
			window.location.href = r.message.redirect_to
		}
	})

});

