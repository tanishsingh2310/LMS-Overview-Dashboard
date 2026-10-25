<?php
namespace local_universitydashboard\local;

defined('MOODLE_INTERNAL') || die();

/**
 * Renders the built React dashboard inside Moodle.
 */
class dashboard_page {
    public static function render(): void {
        global $OUTPUT;

        $plugindir = dirname(__DIR__, 2);
        $builddir = $plugindir . '/build/ui';
        $manifestpath = $builddir . '/manifest.json';

        if (!is_readable($manifestpath)) {
            echo $OUTPUT->notification(
                'Dashboard frontend build not found. Run npm run build in the ui directory.',
                \core\output\notification::NOTIFY_WARNING
            );
            return;
        }

        $manifest = json_decode(
            file_get_contents($manifestpath),
            true
        );

        if (
            !is_array($manifest) ||
            empty($manifest['src/main.jsx']['file'])
        ) {
            echo $OUTPUT->notification(
                'The dashboard frontend manifest is missing or invalid.',
                \core\output\notification::NOTIFY_ERROR
            );
            return;
        }

        $entry = $manifest['src/main.jsx'];
        $baseurl = new \moodle_url('/local/universitydashboard/build/ui');

        if (!empty($entry['css']) && is_array($entry['css'])) {
            foreach ($entry['css'] as $cssfile) {
                $cssurl = new \moodle_url(
                    $baseurl->out(false) . '/' . $cssfile
                );

                echo \html_writer::empty_tag('link', [
                    'rel' => 'stylesheet',
                    'href' => $cssurl->out(false),
                ]);
            }
        }

        echo \html_writer::div('', '', [
            'id' => 'root',
            'data-endpoint' => (new \moodle_url(
                '/local/universitydashboard/ajax.php'
            ))->out(false),
            'data-sesskey' => sesskey(),
        ]);

        $scripturl = new \moodle_url(
            $baseurl->out(false) . '/' . $entry['file']
        );

        echo \html_writer::tag('script', '', [
            'type' => 'module',
            'src' => $scripturl->out(false),
        ]);
    }
}
