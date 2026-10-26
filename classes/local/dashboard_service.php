<?php
namespace local_universitydashboard\local;

defined('MOODLE_INTERNAL') || die();

/**
 * Read-only data service for the University Dashboard.
 *
 * User classifications are based exclusively on system-level role
 * assignments. Course enrollment counts include active enrollments only.
 */
class dashboard_service
{
    /** @var \moodle_database */
    private $db;

    /** Moodle top-level category name => institution profile value. */
    private const SCHOOL_MAP = [
        'GSFC University' => 'GSFCU',
        'SoICT (Erstwhile SoT)' => 'SoICT',
        'SoCEFS (Erstwhile SoT)' => 'SoCEFS',
        'SoLS (Erstwhile SoS)' => 'SoLS',
        'SoCIS (Erstwhile SoS)' => 'SoCIS',
        'SoM&E' => 'SoM&E',
    ];

    private const STUDENT_ROLE = 'students';
    private function get_school_display_name(string $institution): string
{
    return match ($institution) {
        'SoICT' => 'School of Information and Communication Technology',
        'SoCEFS' => 'School of Chemical Engineering and Fire Safety',
        'SoLS' => 'School of Life Sciences',
        'SoCIS' => 'School of Chemical and Industrial Sciences',
        'SoM&E' => 'School of Management and Entrepreneurship',
        'GSFCU' => 'GSFC University',
        default => $institution,
    };
}

    private const STAFF_ROLES = [
        'faculty',
        'visiting',
        'lab',
    ];

    /**
 * Course IDs excluded from student and staff summaries.
 * These courses still count toward university course totals.
 */
/**
 * Check whether a course is excluded from student/staff summaries.
 */

    public function __construct()
    {
        global $DB;
        $this->db = $DB;
    }

    /**
     * Return the dashboard overview totals.
     *
     * @return array
     */
    public function get_dashboard(): array
    {
        $schools = [];

        foreach (self::SCHOOL_MAP as $categoryname => $institution) {
            $category = $this->get_school_category($categoryname);

            if (!$category) {
                continue;
            }

            $categoryids = $this->get_descendant_category_ids(
                (int) $category->id
            );

            $courses = $this->get_courses_for_categories($categoryids);
            $activecourses = 0;

            foreach ($courses as $course) {
                if (empty($course->visible)) {
                    continue;
                }

                $counts = $this->get_course_people_counts(
                    (int) $course->id
                );

                if ($counts['students'] >= 5 && $counts['staff'] >= 1) {
                    $activecourses++;
                }
            }

            $visiblecourses = array_filter(
                $courses,
                static fn($course) => !empty($course->visible)
            );

            $schools[] = [
    'id' => (int) $category->id,
    'type' => $institution === 'GSFCU' ? 'university' : 'school',
    'icon' => match ($institution) {
        'GSFCU' => 'university',
        'SoICT' => 'monitor',
        'SoCEFS' => 'flask',
        'SoLS' => 'leaf',
        'SoCIS' => 'atom',
        'SoM&E' => 'briefcase',
        default => 'university',
    },
    'shortname' => $institution,
    'name' => $this->get_school_display_name($institution),
    'institution' => $institution,
                'courses' => count($visiblecourses),
                'activeCourses' => $activecourses,
                'students' => $this->count_institution_users(
                    $institution,
                    [self::STUDENT_ROLE]
                ),
                'teachers' => $this->count_institution_users(
                    $institution,
                    self::STAFF_ROLES
                ),
                'visitingFaculty' => $this->count_institution_users(
                    $institution,
                    ['visiting']
                ),
                'labInstructors' => $this->count_institution_users(
                    $institution,
                    ['lab']
                ),
            ];
        }

        return [
            'schools' => $schools,
            'generatedAt' => time(),
        ];
    }

    /**
     * Return records for a school's selected metric.
     *
     * @param string $school Institution profile value.
     * @param string $metric Metric key.
     * @return array
     */
    public function get_metric_details(
        string $school,
        string $metric
    ): array {
        if (!in_array($school, array_values(self::SCHOOL_MAP), true)) {
            throw new \invalid_parameter_exception('Unknown school.');
        }

        $category = $this->get_school_category_for_institution($school);

        if (!$category) {
            throw new \moodle_exception(
                'invalidrecord',
                'error',
                '',
                'The configured school category was not found.'
            );
        }

        $categoryid = (int) $category->id;

        if (in_array($metric, ['courses', 'activeCourses'], true)) {
            $courses = $this->get_courses(
                $categoryid,
                $metric === 'activeCourses'
            );

            $rows = [];

            foreach ($courses as $course) {
                $courseid = (int) $course['id'];

                $rows[] = [
                    'id' => $courseid,
                    'fullname' => $course['fullname'],
                    'shortname' => $course['shortname'],
                    'categoryPath' => $course['category'],
                    'studentCount' => $course['students'],
                    'teachers' => $this->get_course_staff_names($courseid),
                    'activities' => $this->get_course_activity_breakdown(
                        $courseid
                    ),
                    'visible' => $course['visible'],
                    'lastAccess' => null,
                    'url' => $course['url'],
                ];
            }

            return [
                'courses' => $rows,
                'users' => [],
            ];
        }

        $peopletype = match ($metric) {
            'students' => 'students',
            'teachers' => 'faculty',
            'visitingFaculty' => 'visiting',
            'labInstructors' => 'lab',
            default => throw new \invalid_parameter_exception(
                'Unsupported dashboard metric.'
            ),
        };

        $people = $this->get_people($peopletype, $categoryid);
        $users = [];

        foreach ($people as $person) {
            $users[] = [
                'id' => $person['id'],
                'username' => $person['username'],
                'enrollmentNo' => $person['enrollmentNo'],
                'fullname' => $person['fullname'],
                'email' => $person['email'],
                'department' => $person['department'],
                'institution' => $person['institution'],
                'idnumber' => $person['batchOrDesignation'],
                'designation' => $person['designation'],
                'courseCount' => $person['courses'],
                'online' => $person['status'] === 'Online',
                'lastAccess' => $person['lastaccessraw'] > 0
                    ? $person['lastaccessraw']
                    : null,
            ];
        }

        return [
            'courses' => [],
            'users' => $users,
        ];
    }

    /**
     * List courses belonging to configured school categories.
     *
     * The teachers field is a staff count in this internal response.
     * Metric details separately return the actual teacher-name array.
     *
     * @param int $categoryid Root category ID; zero means all schools.
     * @param bool $activeonly Return only active courses.
     * @return array
     */
    public function get_courses(
        int $categoryid = 0,
        bool $activeonly = false
    ): array {
        $categoryids = $categoryid > 0
            ? $this->get_descendant_category_ids($categoryid)
            : $this->get_all_school_category_ids();

        if (!$categoryids) {
            return [];
        }

        $courses = $this->get_courses_for_categories($categoryids);
        $rows = [];

        foreach ($courses as $course) {
            $counts = $this->get_course_people_counts(
                (int) $course->id
            );

            $visible = (bool) $course->visible;
            $isactive = $visible
                && $counts['students'] >= 5
                && $counts['staff'] >= 1;

            if (!$visible) {
                continue;
            }

            if ($activeonly && !$isactive) {
                continue;
            }

            $rows[] = [
                'id' => (int) $course->id,
                'fullname' => format_string($course->fullname),
                'shortname' => (string) $course->shortname,
                'teachers' => $counts['staff'],
                'students' => $counts['students'],
                'active' => $isactive,
                'visible' => $visible,
                'category' => $this->get_category_path(
                    (int) $course->category
                ),
                'categoryid' => (int) $course->category,
                'url' => (new \moodle_url('/course/view.php', [
                    'id' => $course->id,
                ]))->out(false),
            ];
        }

        return $rows;
    }

    /**
     * Return users with the configured system-level role.
     *
     * @param string $type User type or role group.
     * @param int $categoryid Optional school category ID.
     * @return array
     */
    public function get_people(
        string $type,
        int $categoryid = 0
    ): array {
        global $CFG;

        $roleshortnames = $this->normalise_people_type($type);
        $roleids = $this->get_role_ids($roleshortnames);

        if (!$roleids) {
            return [];
        }

        [$rolesql, $roleparams] = $this->db->get_in_or_equal(
            $roleids,
            SQL_PARAMS_NAMED,
            'personrole'
        );

        $sql = "SELECT DISTINCT
                       u.id, u.username, u.firstname, u.lastname,
                       u.email, u.department, u.idnumber,
                       u.institution, u.lastaccess
                  FROM {user} u
                  JOIN {role_assignments} ra ON ra.userid = u.id
                  JOIN {context} ctx ON ctx.id = ra.contextid
                 WHERE ctx.contextlevel = :systemcontext
                   AND ra.roleid $rolesql
                   AND u.deleted = 0
                   AND u.suspended = 0
                   AND u.id <> :guestid
              ORDER BY u.lastname ASC, u.firstname ASC";

        $params = [
            'systemcontext' => CONTEXT_SYSTEM,
            'guestid' => (int) $CFG->siteguest,
        ] + $roleparams;

        $users = $this->db->get_records_sql($sql, $params);
        $rows = [];

        $descendants = $categoryid > 0
            ? $this->get_descendant_category_ids($categoryid)
            : [];

        foreach ($users as $user) {
            $category = $this->get_school_category_for_institution(
                (string) $user->institution
            );

            if (!$category) {
                continue;
            }

            if (
                $categoryid > 0
                && !in_array((int) $category->id, $descendants, true)
            ) {
                continue;
            }

            $isstudent = in_array(
                self::STUDENT_ROLE,
                $roleshortnames,
                true
            );

            $rows[] = [
                'id' => (int) $user->id,
                'username' => (string) $user->username,
                'enrollmentNo' => $isstudent
                    ? (string) $user->username
                    : '',
                'fullname' => fullname($user),
                'email' => (string) $user->email,
                'department' => (string) $user->department,
                'batch' => $isstudent
                    ? (string) $user->idnumber
                    : '',
                'designation' => !$isstudent
                    ? (string) $user->idnumber
                    : '',
                'batchOrDesignation' => (string) $user->idnumber,
                'institution' => (string) $user->institution,
                'school' => (string) $category->name,
                'courses' => $this->count_user_enrolled_courses(
                    (int) $user->id
                ),
                'status' => $this->online_status(
                    (int) $user->lastaccess
                ),
                'lastaccess' => $this->format_lastaccess(
                    (int) $user->lastaccess
                ),
                'lastaccessraw' => (int) $user->lastaccess,
            ];
        }

        return $rows;
    }

    /**
     * Return active enrolled courses for a student.
     *
     * @param int $userid User ID.
     * @return array
     */
    public function get_student_courses(int $userid): array
    {
        $this->require_system_role($userid, [self::STUDENT_ROLE]);

        $courses = $this->get_user_enrolled_courses($userid);
        $rows = [];

        foreach ($courses as $course) {
            $lastaccess = (int) ($course->timeaccess ?? 0);

            $rows[] = [
                'id' => (int) $course->id,
                'fullname' => format_string($course->fullname),
                'shortname' => (string) $course->shortname,
                'categoryPath' => $this->get_category_path(
                    (int) $course->category
                ),
                'teachers' => $this->get_course_staff_names(
                    (int) $course->id
                ),
                'lastAccess' => $lastaccess > 0 ? $lastaccess : null,
                'lastaccess' => $this->format_lastaccess($lastaccess),
                'lastaccessraw' => $lastaccess,
                'visible' => true,
                'url' => (new \moodle_url('/course/view.php', [
                    'id' => $course->id,
                ]))->out(false),
            ];
        }

        return $rows;
    }

    /**
     * Return active enrolled courses for a system-level staff user.
     *
     * @param int $userid User ID.
     * @return array
     */
    public function get_teacher_courses(int $userid): array
    {
        $this->require_system_role($userid, self::STAFF_ROLES);

        $courses = $this->get_user_enrolled_courses($userid);
        $rows = [];

        foreach ($courses as $course) {
            $courseid = (int) $course->id;
            $counts = $this->get_course_people_counts($courseid);
            $breakdown = $this->get_course_activity_breakdown($courseid);
            $lastaccess = (int) ($course->timeaccess ?? 0);

            $rows[] = [
                'id' => $courseid,
                'fullname' => format_string($course->fullname),
                'shortname' => (string) $course->shortname,
                'categoryPath' => $this->get_category_path(
                    (int) $course->category
                ),
                'activities' => $breakdown,
                'activitiesResources' => array_sum($breakdown),
                'breakdown' => $breakdown,
                'studentCount' => $counts['students'],
                'students' => $counts['students'],
                'lastAccess' => $lastaccess > 0 ? $lastaccess : null,
                'lastaccess' => $this->format_lastaccess($lastaccess),
                'lastaccessraw' => $lastaccess,
                'visible' => true,
                'url' => (new \moodle_url('/course/view.php', [
                    'id' => $courseid,
                ]))->out(false),
            ];
        }

        return $rows;
    }

    /**
     * Count visible, non-deleted course modules by module type.
     *
     * These are module-instance counts, not student completion counts.
     *
     * @param int $courseid Course ID.
     * @return array Module names mapped to counts.
     */
    private function get_course_activity_breakdown(int $courseid): array
    {
        $sql = "SELECT m.name AS modulename, COUNT(cm.id) AS modulecount
                  FROM {course_modules} cm
                  JOIN {modules} m ON m.id = cm.module
                 WHERE cm.course = :courseid
                   AND cm.visible = 1
                   AND cm.deletioninprogress = 0
                 GROUP BY m.name
              ORDER BY m.name ASC";

        $records = $this->db->get_records_sql($sql, [
            'courseid' => $courseid,
        ]);

        $breakdown = [];

        foreach ($records as $record) {
            $breakdown[(string) $record->modulename] =
                (int) $record->modulecount;
        }

        return $breakdown;
    }

    /**
     * Count distinct enrolled users matching supplied system roles.
     *
     * @param int $courseid Course ID.
     * @return array
     */
    private function get_course_people_counts(int $courseid): array
    {
        return [
            'students' => count($this->get_course_enrolled_user_ids(
                $courseid,
                [self::STUDENT_ROLE]
            )),
            'staff' => count($this->get_course_enrolled_user_ids(
                $courseid,
                self::STAFF_ROLES
            )),
        ];
    }

    /**
     * Get actively enrolled user IDs matching system-level roles.
     *
     * @param int $courseid Course ID.
     * @param array $shortnames Role shortnames.
     * @return array
     */
    private function get_course_enrolled_user_ids(
        int $courseid,
        array $shortnames
    ): array {
        global $CFG;

        $roleids = $this->get_role_ids($shortnames);

        if (!$roleids) {
            return [];
        }

        [$rolesql, $roleparams] = $this->db->get_in_or_equal(
            $roleids,
            SQL_PARAMS_NAMED,
            'enrolledrole'
        );

        $sql = "SELECT DISTINCT u.id
                  FROM {user} u
                  JOIN {user_enrolments} ue ON ue.userid = u.id
                  JOIN {enrol} e ON e.id = ue.enrolid
                  JOIN {role_assignments} ra ON ra.userid = u.id
                  JOIN {context} ctx ON ctx.id = ra.contextid
                 WHERE e.courseid = :courseid
                   AND e.status = 0
                   AND ue.status = 0
                   AND ctx.contextlevel = :systemcontext
                   AND ra.roleid $rolesql
                   AND u.deleted = 0
                   AND u.suspended = 0
                   AND u.id <> :guestid";

        $params = [
            'courseid' => $courseid,
            'systemcontext' => CONTEXT_SYSTEM,
            'guestid' => (int) $CFG->siteguest,
        ] + $roleparams;

        $records = $this->db->get_records_sql($sql, $params);

        return array_map('intval', array_keys($records));
    }

    /**
     * Count system-role users belonging to an institution.
     *
     * @param string $institution Institution profile value.
     * @param array $shortnames Role shortnames.
     * @return int
     */
    private function count_institution_users(
        string $institution,
        array $shortnames
    ): int {
        global $CFG;

        $roleids = $this->get_role_ids($shortnames);

        if (!$roleids) {
            return 0;
        }

        [$rolesql, $roleparams] = $this->db->get_in_or_equal(
            $roleids,
            SQL_PARAMS_NAMED,
            'institutionrole'
        );

        $sql = "SELECT COUNT(DISTINCT u.id)
                  FROM {user} u
                  JOIN {role_assignments} ra ON ra.userid = u.id
                  JOIN {context} ctx ON ctx.id = ra.contextid
                 WHERE ctx.contextlevel = :systemcontext
                   AND ra.roleid $rolesql
                   AND u.institution = :institution
                   AND u.deleted = 0
                   AND u.suspended = 0
                   AND u.id <> :guestid";

        return (int) $this->db->count_records_sql($sql, [
            'systemcontext' => CONTEXT_SYSTEM,
            'institution' => $institution,
            'guestid' => (int) $CFG->siteguest,
        ] + $roleparams);
    }

    /**
     * Get active, visible enrolled courses for a user.
     *
     * @param int $userid User ID.
     * @return array
     */
    private function get_user_enrolled_courses(int $userid): array
{
    $excludedcoursename = 'LearningPlex Tutorials';

    $sql = "SELECT DISTINCT c.id, c.fullname, c.shortname,
                   c.category, c.visible, ula.timeaccess
              FROM {course} c
              JOIN {enrol} e ON e.courseid = c.id
              JOIN {user_enrolments} ue ON ue.enrolid = e.id
              LEFT JOIN {user_lastaccess} ula
                ON ula.userid = ue.userid AND ula.courseid = c.id
             WHERE ue.userid = :userid
               AND ue.status = 0
               AND e.status = 0
               AND c.id <> :sitecourse
               AND c.visible = 1
               AND c.fullname <> :excludedcoursename
          ORDER BY c.fullname ASC, c.id ASC";

    return array_values($this->db->get_records_sql($sql, [
        'userid' => $userid,
        'sitecourse' => SITEID,
        'excludedcoursename' => $excludedcoursename,
    ]));
}

    /**
     * Count active enrolled courses for a user.
     *
     * @param int $userid User ID.
     * @return int
     */
    private function count_user_enrolled_courses(int $userid): int
    {
        return count($this->get_user_enrolled_courses($userid));
    }

    /**
     * Return names of system-role staff actively enrolled in a course.
     *
     * @param int $courseid Course ID.
     * @return array
     */
    private function get_course_staff_names(int $courseid): array
    {
        $ids = $this->get_course_enrolled_user_ids(
            $courseid,
            self::STAFF_ROLES
        );

        if (!$ids) {
            return [];
        }

        [$insql, $params] = $this->db->get_in_or_equal(
            $ids,
            SQL_PARAMS_NAMED,
            'staffname'
        );

        $users = $this->db->get_records_select(
            'user',
            "id $insql AND deleted = 0 AND suspended = 0",
            $params,
            'lastname ASC, firstname ASC'
        );

        $names = [];

        foreach ($users as $user) {
            $names[] = fullname($user);
        }

        return $names;
    }

    /**
     * Resolve role shortnames to IDs.
     *
     * @param array $shortnames Role shortnames.
     * @return array
     */
    private function get_role_ids(array $shortnames): array
    {
        if (!$shortnames) {
            return [];
        }

        [$insql, $params] = $this->db->get_in_or_equal(
            $shortnames,
            SQL_PARAMS_NAMED,
            'roleshortname'
        );

        $records = $this->db->get_records_select(
            'role',
            "shortname $insql",
            $params,
            '',
            'id'
        );

        return array_map('intval', array_keys($records));
    }

    /**
     * Ensure a user has a required system-level role.
     *
     * @param int $userid User ID.
     * @param array $shortnames Allowed role shortnames.
     */
    private function require_system_role(
        int $userid,
        array $shortnames
    ): void {
        $roleids = $this->get_role_ids($shortnames);

        if (!$roleids) {
            throw new \moodle_exception('invaliduser');
        }

        [$rolesql, $params] = $this->db->get_in_or_equal(
            $roleids,
            SQL_PARAMS_NAMED,
            'requiredrole'
        );

        $exists = $this->db->record_exists_sql(
            "SELECT 1
               FROM {role_assignments} ra
               JOIN {context} ctx ON ctx.id = ra.contextid
              WHERE ra.userid = :userid
                AND ctx.contextlevel = :systemcontext
                AND ra.roleid $rolesql",
            [
                'userid' => $userid,
                'systemcontext' => CONTEXT_SYSTEM,
            ] + $params
        );

        if (!$exists) {
            throw new \moodle_exception('invaliduser');
        }
    }

    /**
     * Normalise user types to configured role shortnames.
     *
     * @param string $type User type or metric key.
     * @return array
     */
    private function normalise_people_type(string $type): array
    {
        return match ($type) {
            'student', 'students' => [self::STUDENT_ROLE],
            'teacher', 'teachers', 'faculty' => ['faculty'],
            'visiting', 'visitingFaculty' => ['visiting'],
            'lab', 'labInstructors' => ['lab'],
            'staff' => self::STAFF_ROLES,
            default => throw new \invalid_parameter_exception(
                'Unsupported dashboard people type.'
            ),
        };
    }

    /**
     * Find a configured top-level school category.
     *
     * @param string $name Category name.
     * @return \stdClass|null
     */
    private function get_school_category(string $name): ?\stdClass
{
    $name = html_entity_decode(
        $name,
        ENT_QUOTES | ENT_HTML5,
        'UTF-8'
    );

    $category = $this->db->get_record(
        'course_categories',
        ['name' => $name, 'parent' => 0],
        '*',
        IGNORE_MISSING
    );

    return $category ?: null;
}

    /**
     * Find the category for an institution profile value.
     *
     * @param string $institution Institution value.
     * @return \stdClass|null
     */
    private function get_school_category_for_institution(
        string $institution
    ): ?\stdClass {
        $categoryname = array_search(
            $institution,
            self::SCHOOL_MAP,
            true
        );

        if ($categoryname === false) {
            return null;
        }

        return $this->get_school_category($categoryname);
    }

    /**
     * Get all category IDs belonging to configured schools.
     *
     * @return array
     */
    private function get_all_school_category_ids(): array
    {
        $ids = [];

        foreach (array_keys(self::SCHOOL_MAP) as $name) {
            $category = $this->get_school_category($name);

            if ($category) {
                $ids = array_merge(
                    $ids,
                    $this->get_descendant_category_ids(
                        (int) $category->id
                    )
                );
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * Get courses in supplied categories.
     *
     * @param array $categoryids Category IDs.
     * @return array
     */
    private function get_courses_for_categories(
        array $categoryids
    ): array {
        if (!$categoryids) {
            return [];
        }

        [$insql, $params] = $this->db->get_in_or_equal(
            $categoryids,
            SQL_PARAMS_NAMED,
            'coursecategory'
        );

        return array_values($this->db->get_records_select(
            'course',
            "category $insql AND id <> :sitecourse",
            $params + ['sitecourse' => SITEID],
            'fullname ASC, id ASC'
        ));
    }

    /**
     * Get a category and all its descendants.
     *
     * @param int $rootid Root category ID.
     * @return array
     */
    private function get_descendant_category_ids(int $rootid): array
    {
        $categories = $this->db->get_records(
            'course_categories',
            [],
            'id ASC',
            'id, parent'
        );

        $children = [];

        foreach ($categories as $category) {
            $children[(int) $category->parent][] = (int) $category->id;
        }

        $result = [$rootid];
        $queue = [$rootid];

        while ($queue) {
            $parentid = array_shift($queue);

            foreach ($children[$parentid] ?? [] as $childid) {
                if (!in_array($childid, $result, true)) {
                    $result[] = $childid;
                    $queue[] = $childid;
                }
            }
        }

        return $result;
    }

    /**
     * Build the category breadcrumb path.
     *
     * @param int $categoryid Category ID.
     * @return string
     */
    private function get_category_path(int $categoryid): string
    {
        $parts = [];
        $currentid = $categoryid;

        while ($currentid > 0) {
            $category = $this->db->get_record(
                'course_categories',
                ['id' => $currentid],
                'id, name, parent',
                IGNORE_MISSING
            );

            if (!$category) {
                break;
            }

            array_unshift(
    $parts,
    html_entity_decode(
        format_string($category->name),
        ENT_QUOTES | ENT_HTML5,
        'UTF-8'
    )
);
            $currentid = (int) $category->parent;
        }

        return implode(' / ', $parts);
    }

    /**
     * Calculate recent activity status from site-level last access.
     *
     * This is an approximate online indicator, not a live connection check.
     *
     * @param int $lastaccess Unix timestamp.
     * @return string
     */
    private function online_status(int $lastaccess): string
    {
        if ($lastaccess <= 0) {
            return 'Never';
        }

        return (time() - $lastaccess) <= 300
            ? 'Online'
            : 'Offline';
    }

    /**
     * Format a last-access timestamp.
     *
     * @param int $lastaccess Unix timestamp.
     * @return string
     */
    private function format_lastaccess(int $lastaccess): string
    {
        if ($lastaccess <= 0) {
            return 'Never';
        }

        return userdate($lastaccess);
    }
}
