<?php

namespace Goldnead\BardAssist\Http\Controllers\Concerns;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Request;
use Statamic\Facades\Blueprint;
use Statamic\Facades\User;
use Statamic\Fields\Field;

/**
 * Every endpoint that acts on a field requires the publish form's blueprint
 * token (as core's ReplicatorSetController does) and an opted-in Bard field.
 */
trait ResolvesAssistField
{
    protected function assistField(Request $request): Field
    {
        $request->validate([
            'token' => 'nullable|string',
            'field' => 'required|string',
        ]);

        try {
            $payload = decrypt((string) $request->input('token'));
        } catch (DecryptException) {
            abort(403);
        }

        abort_unless(is_array($payload)
            && is_string($payload['fqh'] ?? null)
            && ($payload['user_id'] ?? null) === User::current()?->id(), 403);

        $blueprint = Blueprint::find($payload['fqh']) ?? abort(404);

        // Top-level Bard fields that opted in; nested ones are not supported yet.
        $field = $blueprint->field($request->input('field'));
        abort_unless($field && $field->type() === 'bard' && $field->get('bard_assist'), 404);

        return $field;
    }
}
