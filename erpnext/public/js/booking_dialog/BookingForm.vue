<template>
	<div class="row" style="min-height: 50vh;">
		<div v-if="error" class="col-12 text-center justify-content-center align-self-center">
			<h2 class="text-muted">{{ error }}</h2>
		</div>
		<div v-else-if="loading" class="col-12 text-center justify-content-center align-self-center">
			<div class="fulfilling-square-spinner mx-auto">
				<div class="spinner-inner"></div>
			</div>
		</div>
		<div v-else-if="!uom" class="col-12 text-center justify-content-center align-self-center">
			<h2 class="text-muted">{{ __("Please select a unit of measure first") }}</h2>
		</div>
		<div v-else class="col-12">
			<FullCalendar
				eventClassName='booking-calendar'
				ref="fullCalendar"
				defaultView="listDay"
				:header="{
					left: 'listWeek, listDay',
					center: 'title',
					right: 'prev,next today',
				}"
				:plugins="calendarPlugins"
				:weekends="calendarWeekends"
				:events="getAvailableSlots"
				:locale="locale"
				:buttonText="buttonText"
				:noEventsMessage="noEventsMessage"
				:selectAllow="selectAllow"
				@eventClick="eventClick"
				:validRange="validRange"
				:defaultDate="defaultDate"
				@datesRender="datesRender"
				:timeZone="timeZone"
			/>
		</div>
	</div>
</template>

<script>
import FullCalendar from '@fullcalendar/vue';
import listPlugin from '@fullcalendar/list';

export default {
	components: {
		FullCalendar
	},
	props: {
		item: {
			default: null
		},
		sales_uom: {
			default: null
		}
	},
	data() {
		return {
			error: null,
			reference: "Item Booking",
			calendarWeekends: true,
			buttonText: {
				today: __("Today"),
				listWeek: __("Week"),
				listDay: __("Day")

			},
			calendarPlugins: [
				listPlugin
			],
			locale: frappe.boot.lang || 'en',
			timeZone: 'UTC',
			slots: [],
			alternative_items: [],
			quotation: null,
			defaultDate: moment().add(1,'d').format("YYYY-MM-DD"),
			loading: false,
			uom: this.sales_uom,
			noEventsMessage: __("No events to display")
		}
	},
	computed: {
		selectAllow: function(selectInfo) {
			return moment().diff(selectInfo.start) <= 0
		},
		validRange: function() {
			return { start: moment().add(1,'d').format("YYYY-MM-DD") }
		},
		readOnly: function() {
			return frappe.session.user === "Guest"
		}
	},
	created() {
		this.getLocale()
		this.getQuotation()
		erpnext.booking_dialog_update.on("refresh", () => {
			this.$refs.fullCalendar.getApi().refetchEvents();
		})

		erpnext.booking_dialog_update.on("uom_change", (value) => {
			this.uom = value;
			this.$refs.fullCalendar.getApi().refetchEvents();
		})
	},
	methods: {
		getAvailableSlots(parameters, callback) {
			if (this.item) {
				this.alternative_items = []
				frappe.call("erpnext.stock.doctype.item_booking.item_booking.get_availabilities", {
					start: moment(parameters.start).format("YYYY-MM-DD"),
					end: moment(parameters.end).format("YYYY-MM-DD"),
					item: this.item,
					quotation: this.quotation,
					uom: this.uom
				}).then(result => {
					this.slots = result.message || []

					callback(this.slots);
					if (!this.slots.length) {
						this.$refs.fullCalendar.getApi().updateSize()
						this.getAvailableItems(parameters)
					}
				})
			}
		},
		getAvailableItems(parameters) {
			return frappe.call("erpnext.stock.doctype.item_booking.item_booking.get_available_item", {
				start: moment(parameters.start).format("YYYY-MM-DD"),
				end: moment(parameters.end).format("YYYY-MM-DD"),
				item: this.item
			}).then(result => {
				if (result && result.message) {
					this.alternative_items = result.message;
					this.displayAlternativeItems()
				}
			})
		},
		displayAlternativeItems() {
			if (this.alternative_items.length) {
				const emptyElems = document.getElementsByClassName("fc-list-empty");
				if (emptyElems.length) {
					const alternative_items_links = this.alternative_items.map(item => {
						return `<div class="card">
									<div class="row no-gutters">
										<div class="col-md-3">
											<div class="card-body">
												<a class="no-underline" href="${'/' + item.route}">
													<img class="website-image" alt=${item.item_name} src=${item.website_image || item.image || '/no-image.jpg'}>
												</a>
											</div>
										</div>
										<div class="col-md-9">
											<div class="card-body">
												<h5 class="card-title">
													<a class="text-dark" href="${'/' + item.route }">
														${item.item_name || item.name }
													</a>
												</h5>
												<p class="card-text">
													${ item.website_content || item.description || `<i class="text-muted">${ __("No description") }</i>` }
												</p>
												<a href="${'/' + item.route }" class="btn btn-sm btn-light">${ __('More details') }</a>
											</div>
										</div>
									</div>
								</card>`
					}).join('')

					emptyElems[0].innerHTML = `
					<div>${__("No events to display for this item")}</div>
					<h3 class="text-muted mb-5">${__("Items available on this date")}</h3>
					${alternative_items_links}
					`
				}
			}
		},
		getQuotation() {
			if (!this.readOnly) {
				frappe.call("erpnext.shopping_cart.cart.get_cart_quotation")
				.then(r => {
					this.quotation = r.message.doc.name
				})
			}
		},
		eventClick(event) {
			if (!this.readOnly) {
				this.loading = true;
				if (event.event.classNames.includes("available")) {
					this.bookNewSlot(event)
				} else {
					this.removeBookedSlot(event)
				}
			} else {
				if(localStorage) {
					localStorage.setItem("last_visited", window.location.pathname);
				}
				window.location.href = "/login"
			}
		},
		bookNewSlot(event) {
			frappe.call("erpnext.stock.doctype.item_booking.item_booking.book_new_slot", {
				start: moment.utc(event.event.start).format("YYYY-MM-DD H:mm:SS"),
				end: moment.utc(event.event.end).format("YYYY-MM-DD H:mm:SS"),
				item: this.item,
				uom: this.uom
			}).then(r => {
				this.getQuotation()
				this.updateCart(r.message.name, 1)
			})
		},
		removeBookedSlot(event) {
			this.getQuotation()
			this.updateCart(event.event.id, 0)
		},
		updateCart(booking, qty) {
			new Promise((resolve) => {
				resolve(
					erpnext.shopping_cart.shopping_cart_update({
						item_code: this.item,
						qty: qty,
						uom: this.uom,
						booking: booking
					})
				)
			}).then(r => {
				// Hack for promise resolving too fast
				setTimeout(() => { this.loading = false; }, (qty == 0) ? 3000: 2000);
			})
		},
		datesRender(event) {
			if (event.view.dayDates.length) {
				this.defaultDate = event.view.dayDates[0]
			}
		},
		getLocale() {
			frappe.call("erpnext.stock.doctype.item_booking.item_booking.get_locale_and_timezone")
			.then(r => {
				this.locale = r.message.locale
				this.timeZone = r.message.time_zone
			})
		}
	}
}
</script>

<style lang='scss'>
@import 'node_modules/@fullcalendar/core/main';
@import 'node_modules/@fullcalendar/list/main';
@import 'frappe/public/scss/variables.scss';

.cart-uom-selector {
	>:not(:last-child) {
		margin-right: .25rem;
	}
}

.fc button {
	height: auto !important;
	font-size: $text-small !important;
	outline: none !important;
	line-height: 10pt !important;
	.fc-icon {
		top: -1px !important;
		font-size: $text-small !important;
	}
}

.fc-list-item {
	cursor: pointer;
	&.unavailable {
		background-color: #f5f5f5;
	}
}

.fc-unthemed .fc-list-empty {
	background-color: #fff;
}

.fc-unthemed .fc-list-view {
	border-color: #fff;
}

.fc-list-empty img:after {
	box-sizing: border-box;
}

.fc-list-empty .card-body {
	text-align: left;
}

.fulfilling-square-spinner , .fulfilling-square-spinner * {
	box-sizing: border-box;
	}

	.fulfilling-square-spinner {
	height: 50px;
	width: 50px;
	position: relative;
	border: 4px solid #6195FF;
	animation: fulfilling-square-spinner-animation 4s infinite ease;
	}

	.fulfilling-square-spinner .spinner-inner {
	vertical-align: top;
	display: inline-block;
	background-color: #6195FF;
	width: 100%;
	opacity: 1;
	animation: fulfilling-square-spinner-inner-animation 4s infinite ease-in;
	}

	@keyframes fulfilling-square-spinner-animation {
	0% {
		transform: rotate(0deg);
	}

	25% {
		transform: rotate(180deg);
	}

	50% {
		transform: rotate(180deg);
	}

	75% {
		transform: rotate(360deg);
	}

	100% {
		transform: rotate(360deg);
	}
	}

	@keyframes fulfilling-square-spinner-inner-animation {
	0% {
		height: 0%;
	}

	25% {
		height: 0%;
	}

	50% {
		height: 100%;
	}

	75% {
		height: 100%;
	}

	100% {
		height: 0%;
	}
	}
</style>