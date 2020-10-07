const stripe = Stripe("{{ publishable_key }}", { locale: "{{ lang }}" });

const isSubscription = "{{ is_subscription }}"
const elements = stripe.elements();
const cardButton = document.getElementById('card-button');
const reloadButton = document.getElementById('card-reload');
const clientSecret = cardButton.dataset.secret;
const data = {{ frappe.form_dict|json }};

const cardElement = elements.create('card', {
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

cardElement.mount('#card-element');

cardButton.addEventListener('click', function(ev) {
	ev.preventDefault();
	$('#card-button').prop('disabled', true)
	$('#card-button').html(__('Processing...'))
	const billingDetails = {
		name: $('input[name=cardholder-name]').val(),
		email: $('input[name=cardholder-email]').val()
	}

	if (isSubscription == "True") {
		handleSubscription(billingDetails)
	} else {
		handleCardPayment(billingDetails)
	}
	
})

const handleSubscription = details => {
	stripe.createToken(cardElement, details)
	.then(result => {
		if (result.error) {
			processError(result.error)
		} else {
			submit_payment_token(result)
		}
	})
}

const handleCardPayment = details => {
	stripe.handleCardPayment(
		clientSecret, cardElement, {
			payment_method_data: {
			  billing_details: details
			}
		  }
	).then(result => {
		if (result.error) {
			processError(result.error)
		} else {
			submit_payment_intent(result)
		}
	})
}

const processError = error => {
	cardButton.style.display = "none"
	document.getElementById('card-errors').textContent = '';
	$('#error-msg').html(error.message);
	$('.error').show()
}

cardElement.on('change', function(event) {
	let displayError = document.getElementById('card-errors');
	if (event.error) {
		displayError.textContent = event.error.message;
	} else {
		displayError.textContent = '';
	}
});

const submit_payment_intent = result => {
	frappe.call({
		method:"erpnext.templates.pages.integrations.stripe_checkout.make_payment_intent",
		freeze:true,
		headers: {"X-Requested-With": "XMLHttpRequest"},
		args: {
			"data": data,
			"intent": result
		}
	}).then(r => {
		processResult(r)
	});
}

const submit_payment_token = result => {
	if (result.token) {
		frappe.call({
			method:"erpnext.templates.pages.integrations.stripe_checkout.make_subscription",
			freeze:true,
			headers: {"X-Requested-With": "XMLHttpRequest"},
			args: {
				"stripe_token_id": result.token.id,
				"data": data
			},
			callback: function(r) {
				processResult(r)
			}
		});
	} else if (result.error) {
		processError(result.error)
	} else {
		console.warn(result)
	}
}

const processResult = r => {
	if (r.message.status in ["Pending", "Completed"]) {
		cardButton.style.display = "none"
		$('.success').show()
		setTimeout(function() {
			window.location.href = r.message.redirect_to
		}, 2000);
	} else if (r.message.status == "Incomplete") {
		const paymentIntentSecret = r.message.payment_intent.client_secret;
		stripe.handleCardPayment(paymentIntentSecret).then(function(result) {
			if (result.error) {
				processError(result.error)
			} else {
				submit_payment_intent(result)
			}
		});
	} else {
		cardButton.style.display = "none"
		setTimeout(function() {
			window.location.href = r.message.redirect_to
		}, 2000);
	}
}

reloadButton.addEventListener('click', function(ev) {
	location.reload();
})