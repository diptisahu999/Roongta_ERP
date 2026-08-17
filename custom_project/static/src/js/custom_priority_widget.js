/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { Component, useState } from "@odoo/owl";

export class CustomPriorityDropdown extends Component {
    static template = "custom_project.CustomPriorityDropdown";
    static props = {
        ...standardFieldProps,
    };

    setup() {
        this.state = useState({
            isOpen: false,
        });
        
        this.options = [
            { value: '0', label: 'Low', icon: 'fa fa-circle', color: '#60a5fa', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
            { value: '1', label: 'Medium', icon: 'fa fa-minus', color: '#eab308', bgColor: '#fefce8', borderColor: '#fef08a' },
            { value: '2', label: 'High', icon: 'fa fa-arrow-up', color: '#f97316', bgColor: '#fff7ed', borderColor: '#fed7aa' },
            { value: '3', label: 'Urgent', icon: 'fa fa-exclamation', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca' },
        ];
    }

    get selectedOption() {
        return this.options.find(o => o.value === this.props.record.data[this.props.name]) || this.options[0];
    }

    toggleDropdown = () => {
        this.state.isOpen = !this.state.isOpen;
    }

    selectOption = (value) => {
        this.props.record.update({ [this.props.name]: value });
        this.state.isOpen = false;
    }
}

registry.category("fields").add("custom_priority_dropdown", {
    component: CustomPriorityDropdown,
});
