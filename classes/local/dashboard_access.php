<?php
namespace local_universitydashboard\local;

defined('MOODLE_INTERNAL') || die();

/**
 * Access control for the University Dashboard.
 */
class dashboard_access {
    /**
     * Allowed system-level role shortnames.
     */
    private const ALLOWED_ROLE_SHORTNAMES = [
        'authority',
        'deans',
        'hods',
        'pcs',
    ];

    /**
     * Require a logged-in user with an allowed system-level role.
     *
     * @return void
     */
    public static function require_access(): void {
    require_login();

    if (!self::can_access()) {
        throw new \required_capability_exception(
            \context_system::instance(),
            'local/universitydashboard:view',
            'nopermissions',
            ''
        );
    }
}

    /**
     * Check whether the current user has an allowed system-level role.
     *
     * @return bool
     */
    public static function can_access(): bool {
    global $DB, $USER;

    if (!isloggedin() || isguestuser()) {
        return false;
    }

    // Allow Moodle site administrators.
    if (is_siteadmin()) {
        return true;
    }

    $context = \context_system::instance();
    $roleids = self::get_allowed_role_ids();

    if (!$roleids) {
        return false;
    }

    [$insql, $params] = $DB->get_in_or_equal(
        $roleids,
        SQL_PARAMS_NAMED,
        'dashrole'
    );

    return $DB->record_exists_sql(
        "SELECT 1
           FROM {role_assignments} ra
           JOIN {context} ctx ON ctx.id = ra.contextid
          WHERE ra.userid = :userid
            AND ctx.id = :contextid
            AND ra.roleid $insql",
        [
            'userid' => (int)$USER->id,
            'contextid' => (int)$context->id,
        ] + $params
    );
}

    /**
     * Get role IDs using exact configured shortnames.
     *
     * @return array
     */
    private static function get_allowed_role_ids(): array {
        global $DB;

        $roleids = [];

        foreach (self::ALLOWED_ROLE_SHORTNAMES as $shortname) {
            $roleid = $DB->get_field(
                'role',
                'id',
                ['shortname' => $shortname]
            );

            if ($roleid !== false) {
                $roleids[] = (int)$roleid;
            }
        }

        return array_values(array_unique($roleids));
    }
}
