/** @odoo-module **/

import { Component, xml } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class TaskProgressSelectField extends Component {
    static template = xml`
        <div class="d-inline-block" t-on-click.stop="">
            <select class="form-select form-select-sm py-0 px-1 border-0 bg-transparent text-primary fw-bold"
                    style="cursor: pointer; width: auto; font-size: 13px;"
                    t-on-change="onChange">
                <t t-foreach="options" t-as="opt" t-key="opt[0]">
                    <option t-att-value="opt[0]" t-att-selected="opt[0] === currentVal">
                        <t t-esc="opt[1]"/>
                    </option>
                </t>
            </select>
        </div>
    `;

    static props = {
        ...standardFieldProps,
    };

    get options() {
        return [
            ['0', '0%'],
            ['10', '10%'],
            ['20', '20%'],
            ['30', '30%'],
            ['40', '40%'],
            ['50', '50%'],
            ['60', '60%'],
            ['70', '70%'],
            ['80', '80%'],
            ['90', '90%'],
            ['100', '100%'],
        ];
    }

    get currentVal() {
        return String(this.props.record.data[this.props.name] || '0');
    }

    async onChange(ev) {
        ev.stopPropagation();
        const newVal = ev.target.value;
        await this.props.record.update({ [this.props.name]: newVal });
        await this.props.record.save();
    }
}

export const taskProgressSelectField = {
    component: TaskProgressSelectField,
    supportedTypes: ["selection"],
};

registry.category("fields").add("task_progress_select", taskProgressSelectField);
