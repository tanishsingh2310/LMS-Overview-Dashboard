<?php
namespace local_universitydashboard\custompages;

defined('MOODLE_INTERNAL') || die();

/**
 * Makes the University Dashboard available to local_custompages.
 */
class provider implements \local_custompages\provider {
    /**
     * Return the pages this plugin provides.
     */
    public function get_pages(): array {
        return [
            [
                'slug' => 'universitydashboard',
                'title' => 'University Dashboard',
            ],
        ];
    }

    /**
     * Render a registered provider page.
     *
     * @param string $slug Provider page slug.
     */
    public function render_page(string $slug): void {
    if ($slug !== 'universitydashboard') {
        throw new \moodle_exception(
            'invalidparameter',
            'error',
            '',
            'Unknown dashboard page'
        );
    }

    \local_universitydashboard\local\dashboard_access::require_access();

    \local_universitydashboard\local\dashboard_page::render();
}
}
