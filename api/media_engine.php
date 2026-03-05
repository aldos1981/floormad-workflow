<?php
/**
 * Floormad Workflow - Media Engine (File Upload & Management)
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

function ensure_project_dir($project_id)
{
    $path = UPLOAD_DIR . '/' . $project_id;
    if (!is_dir($path)) {
        mkdir($path, 0755, true);
    }
    return $path;
}

/**
 * Returns a list of files in the project's upload directory.
 */
function get_media_files($project_id)
{
    $path = ensure_project_dir($project_id);
    $files = [];

    // Check for metadata file
    $meta_path = $path . '/metadata.json';
    $metadata = [];
    if (file_exists($meta_path)) {
        $content = file_get_contents($meta_path);
        $metadata = json_decode($content, true) ?: [];
    }

    $entries = scandir($path);
    foreach ($entries as $filename) {
        if ($filename === '.' || $filename === '..' || $filename === 'metadata.json' || $filename[0] === '.') {
            continue;
        }

        $file_path = $path . '/' . $filename;
        if (!is_file($file_path))
            continue;

        $stats = stat($file_path);
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        // Determine icon
        $icon = '📄';
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp']))
            $icon = '🖼️';
        elseif ($ext === 'pdf')
            $icon = '📕';
        elseif (in_array($ext, ['csv', 'xlsx', 'xls']))
            $icon = '📊';
        elseif (in_array($ext, ['doc', 'docx', 'txt', 'md']))
            $icon = '📝';
        elseif (in_array($ext, ['mp4', 'mov']))
            $icon = '🎬';

        $meta = $metadata[$filename] ?? [];

        $files[] = [
            'name' => $filename,
            'size' => $stats['size'],
            'modified' => date('c', $stats['mtime']),
            'icon' => $icon,
            'type' => '.' . $ext,
            'url' => "/api/projects/$project_id/media/file/$filename",
            'ai_summary' => $meta['summary'] ?? '',
            'ai_status' => $meta['status'] ?? 'raw'
        ];
    }

    // Sort by modified desc
    usort($files, function ($a, $b) {
        return strcmp($b['modified'], $a['modified']);
    });

    return $files;
}

/**
 * Save uploaded file.
 */
function save_uploaded_file($project_id, $tmp_name, $original_name)
{
    $path = ensure_project_dir($project_id);
    $file_path = $path . '/' . $original_name;

    if (!move_uploaded_file($tmp_name, $file_path)) {
        return ['success' => false, 'message' => 'Failed to move uploaded file'];
    }

    // Try AI summary
    $summary = process_file_with_ai($project_id, $original_name, $file_path);

    return [
        'success' => true,
        'message' => 'File uploaded',
        'filename' => $original_name,
        'ai_summary' => $summary
    ];
}

/**
 * Delete a media file.
 */
function delete_media_file($project_id, $filename)
{
    $path = ensure_project_dir($project_id);
    $file_path = $path . '/' . $filename;

    if (file_exists($file_path)) {
        unlink($file_path);

        // Update metadata
        $meta_path = $path . '/metadata.json';
        if (file_exists($meta_path)) {
            $data = json_decode(file_get_contents($meta_path), true) ?: [];
            unset($data[$filename]);
            file_put_contents($meta_path, json_encode($data, JSON_PRETTY_PRINT));
        }

        return ['success' => true, 'message' => 'File deleted'];
    }

    return ['success' => false, 'message' => 'File not found'];
}

/**
 * Process file with AI for summary.
 */
function process_file_with_ai($project_id, $filename, $file_path)
{
    require_once __DIR__ . '/llm_utils.php';

    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $content = '';

    if (in_array($ext, ['txt', 'md', 'csv', 'json', 'xml'])) {
        $content = file_get_contents($file_path);
        if (strlen($content) > 10000) {
            $content = substr($content, 0, 10000);
        }
    } else {
        return "Format not supported for AI summary";
    }

    if (empty(trim($content)) || strlen(trim($content)) < 10) {
        return "No text content found";
    }

    $system_prompt = "You are a helpful assistant. Summarize this document in 2-3 sentences max.";
    $user_prompt = "File: $filename\nContent:\n" . substr($content, 0, 5000);

    $summary = call_llm($system_prompt, $user_prompt);

    // Save metadata
    $path = dirname($file_path);
    $meta_path = $path . '/metadata.json';

    $data = [];
    if (file_exists($meta_path)) {
        $data = json_decode(file_get_contents($meta_path), true) ?: [];
    }

    $data[$filename] = [
        'summary' => $summary,
        'status' => 'done',
        'last_processed' => date('c')
    ];

    file_put_contents($meta_path, json_encode($data, JSON_PRETTY_PRINT));

    return $summary;
}
