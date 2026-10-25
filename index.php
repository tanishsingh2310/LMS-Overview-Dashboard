<?php
require_once(__DIR__ . '/../../config.php');

use local_universitydashboard\local\dashboard_access;
use local_universitydashboard\local\dashboard_page;

dashboard_access::require_access();

$context = context_system::instance();

$PAGE->set_context($context);
$PAGE->set_url(new moodle_url('/local/universitydashboard/index.php'));
$PAGE->set_pagelayout('standard');
$PAGE->set_title(get_string('pluginname', 'local_universitydashboard'));
$PAGE->set_heading(get_string('pluginname', 'local_universitydashboard'));

echo $OUTPUT->header();

dashboard_page::render();

echo $OUTPUT->footer();
