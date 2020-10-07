frappe.listview_settings['Item Booking'] = {
	get_indicator: function(doc) {
		if (doc.status == "Confirmed") {
			return [__("Confirmed"), "green", "status,=,Confirmed"];
		} else if (doc.status == "Cancelled") {
			return [__("Cancelled"), "red", "status,=,Cancelled"];
		} else if (doc.status == "In Cart") {
			return [__("In Cart"), "orange", "status,=,In Cart"];
		} else if (doc.status == "Not Confirmed") {
			return [__("Not Confirmed"), "darkgrey", "status,=,Not Confirmed"];
		}
	}
};