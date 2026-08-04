# -*- coding: utf-8 -*-
"""
Migration script: v1.1
Sets all active languages to use DD/MM/YYYY date format.
Runs automatically on every `odoo-bin -u custom_project` (upgrade).
"""
import logging

_logger = logging.getLogger(__name__)


def migrate(cr, version):
    """Called by Odoo after upgrading to this version."""
    cr.execute(
        "UPDATE res_lang SET date_format = %s WHERE active = true AND date_format != %s;",
        ('%d/%m/%Y', '%d/%m/%Y')
    )
    updated = cr.rowcount
    _logger.info(
        "custom_project migration 1.1: Date format updated to %%d/%%m/%%Y "
        "for %d language(s).", updated
    )
