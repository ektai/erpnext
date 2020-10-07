// Copyright (c) 2019, Dokos SAS and contributors
// For license information, please see license.txt

frappe.views.calendar["Shift Assignment"] = {
	field_map: {
		"start": "start",
		"end": "end",
		"id": "name",
		"docstatus": 1,
		"allDay": "allDay",
		"color": "color"
	},
	order_by: "date",
	gantt: false,
	get_events_method: "erpnext.hr.doctype.shift_assignment.shift_assignment.get_events"
}