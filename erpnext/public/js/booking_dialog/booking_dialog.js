import BookingForm from './BookingForm.vue';
frappe.provide("erpnext.booking_dialog");
frappe.provide("erpnext.booking_dialog_update")

erpnext.booking_dialog = class BookingDialog {
	constructor(opts) {
		Object.assign(this, opts);
		this.sales_uom = null;
		this.uoms = [];
		this.uoms_btns = {};
		this.show()
	}

	show() {
		frappe.require([
			'/assets/js/frappe-vue.min.js',
			'/assets/js/moment-bundle.min.js',
			'/assets/js/control.min.js'
		], () => {
			frappe.utils.make_event_emitter(erpnext.booking_dialog_update);
			this.get_selling_uoms()
			.then(() => {
				this.build_dialog()
				this.build_calendar()
			})
		});
	}

	read_only() {
		return frappe.session.user === "Guest"
	}

	build_dialog() {
		this.dialog = new frappe.ui.Dialog({
			size: "large",
			fields: [
				{
					fieldname: 'booking_section',
					fieldtype: 'HTML',
				}
			],
			primary_action_label: this.read_only() ? __('Login to select') : __('View in Cart'),
			primary_action: () => {
				this.dialog.hide()
				if (this.read_only()) {
					if(localStorage) {
						localStorage.setItem("last_visited", window.location.pathname);
					}
					window.location.href = "/login"
				} else {
					window.location.href = "/cart"
				}
			}
		})

		this.dialog.$wrapper.find(".modal-title").css("text-align", "center")
		this.dialog.$wrapper.find(".modal-title").css("margin", "auto")
		this.header = this.dialog.$wrapper.find(".modal-header")
		this.footer = this.dialog.$wrapper.find(".modal-footer")

		this.add_secondary_action()
		this.add_uom_selector()

		this.dialog.show()
	}

	build_calendar() {
		this.wrapper = this.dialog.fields_dict.booking_section.$wrapper[0];

		new Vue({
			el: this.wrapper,
			render: h => h(BookingForm, {
				props: { item: this.item, sales_uom: this.sales_uom }
			})
		})
	}

	add_secondary_action() {
		if (!this.read_only()) {
			this.secondary_action = $(`
				<button type="button" class="btn btn-sm btn-secondary">${__("Reset")}</button>
			`).prependTo(this.footer)
			this.secondary_action.on('click', () => {
				frappe.call("erpnext.stock.doctype.item_booking.item_booking.reset_all_booked_slots")
				.then(r => {
					erpnext.booking_dialog_update.trigger('refresh');
					erpnext.shopping_cart.shopping_cart_update({
						item_code: this.item,
						qty: 0
					})
				})
			})
		}
	}

	add_uom_selector() {
		this.get_item_price()
		this.show_uom_selector()
	}

	show_uom_selector() {
		if (this.header_btns_wrapper) {
			this.header_btns_wrapper.remove()
		}

		if (this.uoms.length) {
			this.header_btns_wrapper = $(`<div class="cart-uom-selector"></div>`).prependTo(this.header)
			this.uoms.forEach(value => {
				const disabled = (value === this.sales_uom) ? "disabled": ""
				const btnStyle = (value === this.sales_uom) ? "btn-outline-secondary": "btn-outline-primary"
				this.uoms_btns[value] = $(`<button type="button" class="btn btn-sm ${btnStyle}" ${disabled}>${__(value)}</button>`).prependTo(this.header_btns_wrapper)

				this.uoms_btns[value].on('click', () => {
					erpnext.booking_dialog_update.trigger('uom_change', value);
					this.sales_uom = value;
					this.show_uom_selector();
					this.get_item_price();
				})
			})
		}
	}

	get_selling_uoms() {
		return frappe.call(
			'erpnext.stock.doctype.item_booking.item_booking.get_item_uoms',
			{ item_code: this.item }
		).then(r => {
			if (r.message) {
				this.uoms = r.message.uoms.flat()
				if (!this.uoms.includes(r.message.sales_uom) && r.message.sales_uom !== null) {
					this.uoms.unshift(r.message.sales_uom)
				}
				this.sales_uom = r.message.sales_uom
			}
		})
	}

	get_item_price() {
		return frappe.call(
			'erpnext.stock.doctype.item_booking.item_booking.get_item_price',
			{ item_code: this.item, uom: this.sales_uom }
		).then(r => {
			if (r && r.message) {
				const price = r.message.price ? r.message.price.formatted_price : ''
				this.dialog.set_title(`${r.message.item_name}<h4>${price}</h4>`)
			}
		})
		
	}
}