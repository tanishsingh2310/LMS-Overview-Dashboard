<?php
define('AJAX_SCRIPT', true);

require_once(__DIR__ . '/../../config.php');

require_login();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

try {
    \local_universitydashboard\local\dashboard_access::require_access();

    require_sesskey();

    $action = required_param('action', PARAM_ALPHANUMEXT);

    $service = new \local_universitydashboard\local\dashboard_service();

    switch ($action) {
        case 'overview':
            $data = $service->get_dashboard();
            break;

        case 'metric_details':
            $school = required_param('school', PARAM_ALPHANUMEXT);
            $metric = required_param('metric', PARAM_ALPHANUMEXT);

            $allowedmetrics = [
                'courses',
                'activeCourses',
                'students',
                'teachers',
                'visitingFaculty',
                'labInstructors',
            ];

            if (!in_array($metric, $allowedmetrics, true)) {
                throw new \invalid_parameter_exception(
                    'Unsupported dashboard metric.'
                );
            }

            $data = $service->get_metric_details($school, $metric);
            break;

        case 'courses':
            $categoryid = optional_param('categoryid', 0, PARAM_INT);
            $activeonly = optional_param('activeonly', 0, PARAM_BOOL);

            $data = [
                'courses' => $service->get_courses(
                    $categoryid,
                    $activeonly
                ),
            ];
            break;

        case 'students':
            $categoryid = optional_param('categoryid', 0, PARAM_INT);

            $data = [
                'users' => $service->get_people(
                    'students',
                    $categoryid
                ),
            ];
            break;

        case 'staff':
            $categoryid = optional_param('categoryid', 0, PARAM_INT);

            $data = [
                'users' => $service->get_people(
                    'staff',
                    $categoryid
                ),
            ];
            break;

        case 'student_courses':
            $userid = required_param('userid', PARAM_INT);

            if ($userid <= 0) {
                throw new \invalid_parameter_exception(
                    'A valid user ID is required.'
                );
            }

            $data = [
                'courses' => $service->get_student_courses($userid),
            ];
            break;

        case 'staff_courses':
            $userid = required_param('userid', PARAM_INT);

            if ($userid <= 0) {
                throw new \invalid_parameter_exception(
                    'A valid user ID is required.'
                );
            }

            $data = [
                'courses' => $service->get_teacher_courses($userid),
            ];
            break;

        default:
            throw new \invalid_parameter_exception(
                'Unsupported dashboard action.'
            );
    }

    echo json_encode([
        'success' => true,
        'data' => $data,
    ], JSON_THROW_ON_ERROR);

} catch (\invalid_parameter_exception $e) {
    http_response_code(400);

    echo json_encode([
        'success' => false,
        'message' => 'Invalid dashboard request.',
    ]);

} catch (\required_capability_exception $e) {
    http_response_code(403);

    echo json_encode([
        'success' => false,
        'message' => 'You do not have permission to access this dashboard.',
    ]);

} catch (\Throwable $e) {
    // Log details for administrators without exposing them to the browser.
    debugging(
        'University Dashboard AJAX error: ' . $e->getMessage(),
        DEBUG_DEVELOPER
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to load dashboard data. Check the Moodle logs.',
    ]);
}

exit;
