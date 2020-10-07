// Copyright (c) 2019, Dokos SAS and Contributors
// License: See license.txt

const stripe = Stripe("{{ publishable_key }}", { locale: "{{ lang }}" });
const elements = stripe.elements();

$(document).ready(function() {
	new stripe_payment_methods();
});

stripe_payment_methods = class {
	constructor(opts) {
		$.extend(this, opts);
		this.bind_buttons()
	}

	bind_buttons() {
		const me = this;
		$("#add-card").click(function(){
			me.add_new_card();
		})

		$(".remove-card").click(function(event){
			me.delete_card(event.target.id)
		})
	}

	add_new_card() {
		$("#add-card").addClass('d-none');
		$("#card-form").addClass('d-block');
		this.cardElement = elements.create('card', {
			hidePostalCode: true,
			style: {
				base: {
					color: '#32325d',
					lineHeight: '18px',
					fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
					fontSmoothing: 'antialiased',
					fontSize: '16px',
					'::placeholder': {
						color: '#aab7c4'
					}
				},
				invalid: {
					color: '#fa755a',
					iconColor: '#fa755a'
				}
			}
		});
		this.cardElement.mount('#card-element');

		this.bind_card_events()
	}

	bind_card_events() {
		const me = this;
		// Handle real-time validation errors from the card Element.
		this.cardElement.addEventListener('change', function(event) {
			const displayError = document.getElementById('card-errors');
			if (event.error) {
			displayError.textContent = event.error.message;
			} else {
			displayError.textContent = '';
			}
		});
		
		// Handle form submission.
		const submitButton = document.getElementById('card-submit');
		submitButton.addEventListener('click', function(event) {
			event.preventDefault();
		
			stripe.createToken(me.cardElement).then(function(result) {
				if (result.error) {
					// Inform the user if there was an error.
					const errorElement = document.getElementById('card-errors');
					errorElement.textContent = result.error.message;
				} else {
					// Send the token to your server.
					me.stripeTokenHandler(result.token);
				}
			});
		});
	}

	stripeTokenHandler(token) {
		frappe.call({
			method:"erpnext.www.me.add_new_payment_card",
			freeze:true,
			headers: {"X-Requested-With": "XMLHttpRequest"},
			args: {
				token: token
			}
		}).then(r => {
			location.reload()
		});
	}

	delete_card(id) {
		frappe.call({
			method:"erpnext.www.me.remove_payment_card",
			freeze:true,
			headers: {"X-Requested-With": "XMLHttpRequest"},
			args: {
				id: id
			}
		}).then(r => {
			location.reload()
		});
	}
}