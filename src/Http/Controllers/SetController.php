<?php

namespace Goldnead\BardAssist\Http\Controllers;

use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Statamic\Facades\Blueprint;
use Statamic\Facades\Data;
use Statamic\Facades\User;
use Statamic\Fields\Fields;
use Statamic\Http\Controllers\CP\CpController;

/**
 * A suggested set, with values. Modelled on core's ReplicatorSetController,
 * including its token check: the blueprint token the publish form carries.
 */
class SetController extends CpController
{
    /**
     * Pre-processed values and meta, so e.g. a link field shows its target at once.
     */
    public function values(Request $request): JsonResponse
    {
        [$fields, $raw] = $this->fields($request);
        $filled = $fields->addValues($raw)->preProcess();

        return response()->json([
            'values' => $filled->values()->all(),
            'meta' => $filled->meta()->put('_', '_')->toArray(),
        ]);
    }

    /**
     * The set as HTML, drawn with the site's own partial, for the live preview.
     * No partial, no HTML: the suggestion then stays out of the preview.
     */
    public function render(Request $request): Response
    {
        [$fields, $raw] = $this->fields($request);

        $view = $this->partial($request->input('set'));

        if (! $view) {
            return response('', 204);
        }

        // Process first, as on save, then augment: turns entry::<id> into a URL.
        $data = $fields->addValues($raw)->process()->augment()->values()->all();

        return response(view($view, ['type' => $request->input('set')] + $data)->render());
    }

    private function partial(string $handle): ?string
    {
        $name = str_replace('{handle}', $handle, (string) config('bard-assist.preview.partial', 'partials/sets/{handle}'));
        $underscored = Str::contains($name, '/') ? Str::beforeLast($name, '/').'/_'.Str::afterLast($name, '/') : '_'.$name;

        return collect([$name, $underscored])->first(fn ($v) => view()->exists($v));
    }

    /**
     * @return array{0: Fields, 1: array<string, mixed>}
     */
    private function fields(Request $request): array
    {
        $request->validate([
            'token' => 'required|string',
            'reference' => 'nullable|string',
            'field' => 'required|string',
            'set' => 'required|string',
            'values' => 'array',
        ]);

        try {
            $payload = decrypt($request->input('token'));
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

        $sets = $field->get('sets') ?? [];
        if (Arr::has(Arr::first($sets) ?? [], 'sets')) {
            $sets = collect($sets)->flatMap(fn ($group) => $group['sets'] ?? [])->all();
        }
        $set = $sets[$request->input('set')] ?? abort(404);

        $fields = new Fields(
            items: $set['fields'] ?? [],
            parent: $request->filled('reference') ? Data::find($request->input('reference')) : null,
            parentField: $field,
            parentIndex: -1,
        );

        $defaults = $fields->all()->map(fn ($f) => $f->fieldtype()->preProcess($f->defaultValue()))->all();

        return [$fields, array_merge($defaults, array_intersect_key($request->input('values', []), $defaults))];
    }
}
