# -*- coding: utf-8 -*-
{
    'name': 'Project REST API',
    'version': '1.0',
    'category': 'Project',
    'summary': 'Expose Projects and Tasks via public JSON REST API endpoints',
    'description': """
        Provides a REST API for external apps and mobile clients to perform
        full CRUD operations on Odoo Projects and Tasks via HTTP JSON endpoints.

        Endpoints:
          GET    /api/projects                   - List all projects
          GET    /api/projects/<id>              - Get a single project
          POST   /api/projects                   - Create a project
          PUT    /api/projects/<id>              - Update a project
          DELETE /api/projects/<id>              - Delete a project

          GET    /api/tasks                      - List all tasks
          GET    /api/tasks/<id>                 - Get a single task
          POST   /api/tasks                      - Create a task
          PUT    /api/tasks/<id>                 - Update a task
          DELETE /api/tasks/<id>                 - Delete a task
    """,
    'depends': ['project'],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
