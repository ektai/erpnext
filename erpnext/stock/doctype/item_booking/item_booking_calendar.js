// Copyright (c) 2019, Dokos SAS and Contributors
// License: See license.txt

frappe.views.calendar["Item Booking"] = {
	field_map: {
		"start": "starts_on",
		"end": "ends_on",
		"id": "name",
		"title": "title",
		"allDay": "all_day",
		"rrule": "rrule",
		"color": "color"
	},
	filters: [["Item Booking", "status","!=", "Cancelled"]]
};