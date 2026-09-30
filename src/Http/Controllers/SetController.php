<?php

namespace Goldnead\BardAssist\Http\Controllers;

use Goldnead\BardAssist\Http\Controllers\Concerns\ResolvesAssistField;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Statamic\Facades\Data;
use Statamic\Fields\Fields;
use Statamic\Http\Controllers\CP\CpController;

/**
 * A suggested set, with values. Modelled on core's ReplicatorSetController,
 * including its token check: the blueprint token the publish form carries.
 */
class SetController extends CpController
{
    use ResolvesAssistField;

    /** Fields filled from the editor's text: typed lines, and a link (a URL can come from the text). */
    private const PREVIEW_ESCAPED = ['text', 'textarea', 'list', 'markdown', 'link'];

    /**
     * Pre-processed values and meta, so e.g. a link field shows its target at once.
     *
     * Values are NOT escaped here: they become a real set in the entry, and
     * Statamic's templates treat stored text like any other stored text.
     * Escaping now would store &lt; and show it double-escaped later.
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
     *
     * The HTML is inserted into the same-origin preview document, and Antlers
     * partials usually print {{ value }} unescaped. So the typed lines are
     * escaped before rendering: the preview shows text, never markup.
     */
    public function render(Request $request): Response
    {
        [$fields, $raw] = $this->fields($request);

        $view = $this->partial($request->input('set'));

        if (! $view) {
            return response('', 204);
        }

        // Process first, as on save, then augment: turns entry::<id> into a URL.
        $data = $fields->addValues($this->escapeLines($fields, $raw))->process()->augment()->values()->all();

        return response(view($view, ['type' => $request->input('set')] + $data)->render());
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function escapeLines(Fields $fields, array $values): array
    {
        foreach ($fields->all() as $handle => $field) {
            if (! array_key_exists($handle, $values) || ! in_array($field->type(), self::PREVIEW_ESCAPED, true)) {
                continue;
            }

            $v = $values[$handle];
            $values[$handle] = is_array($v)
                ? array_map(fn ($item) => is_string($item) ? e($item) : $item, $v)
                : (is_string($v) ? e($v) : $v);
        }

        return $values;
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
        $field = $this->assistField($request);

        $request->validate([
            'reference' => 'nullable|string',
            'set' => 'required|string|alpha_dash',
            'values' => 'array',
        ]);

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
