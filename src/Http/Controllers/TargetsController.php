<?php

namespace Goldnead\BardAssist\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Statamic\Contracts\Entries\Entry as EntryContract;
use Statamic\Facades\Collection;
use Statamic\Facades\Entry;
use Statamic\Facades\Site;
use Statamic\Facades\User;
use Statamic\Http\Controllers\CP\CpController;

/**
 * Entries a link field in a suggested set may point to, with what they are about.
 */
class TargetsController extends CpController
{
    public function __invoke(): JsonResponse
    {
        $user = User::current();
        $field = (string) config('bard-assist.targets.description_field', 'description');
        $configured = config('bard-assist.targets.collections');

        $handles = Collection::all()
            ->filter(fn ($c) => is_array($configured)
                ? in_array($c->handle(), $configured, true)
                : $c->routes()->filter()->isNotEmpty())
            ->filter(fn ($c) => $user?->can('view', $c))
            ->map->handle()
            ->values()
            ->all();

        if (! $handles) {
            return response()->json([]);
        }

        $targets = Entry::query()
            ->whereIn('collection', $handles)
            ->where('site', Site::selected()->handle())
            ->whereStatus('published')
            ->orderBy('title')
            ->limit((int) config('bard-assist.targets.limit', 100))
            ->get()
            ->filter(fn (EntryContract $e) => $e->url())
            ->map(function (EntryContract $e) use ($field) {
                $title = is_string($t = $e->get('title')) ? $t : (string) $e->id();
                $description = $e->get($field);

                return [
                    'id' => $e->id(),
                    'title' => $title,
                    'url' => $e->url(),
                    // A Bard or array field cannot describe a page to the model; the title can.
                    'description' => is_string($description) && trim($description) !== '' ? $description : $title,
                ];
            })
            ->values();

        return response()->json($targets);
    }
}
