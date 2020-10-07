# Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

from __future__ import unicode_literals

import frappe
from frappe.desk.doctype.desk.desk import WidgetCreator
from frappe.desk.doctype.desk.desk import create_user_desk

def work():
    users = frappe.get_all("User", filters={"user_type": "System User", "name": ("not in", ("Guest", "Administrator"))})
    for user in users:
        frappe.set_user(user.name)
        try:
            create_user_desk(user.name)
        except frappe.DuplicateEntryError:
            pass

        for chart in frappe.get_all("Dashboard Chart"):
                widget = WidgetCreator("Desk", user=user.name)
                widget.add_widget("Dashboard Chart", **{
                    "chart": chart.name
                })

        widget = WidgetCreator("Desk", user=user.name)
        widget.add_widget("Dashboard Calendar", **{
            "reference": "Event",
            "user": user.name
        })