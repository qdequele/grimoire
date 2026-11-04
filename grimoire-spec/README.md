# Grimoire

A keeper's companion for d100 investigation and horror tabletop games: the story on one screen, scene by scene, with clickable rolls, investigators, combat, sounds and a session log.

> Grimoire is an independent fan project. It ships no copyrighted scenario content: you bring your own stories, written by you or imported from books you own.

## What's in this repo (so far)

| Path | What it is |
|---|---|
| [`spec/STORY_FORMAT.md`](spec/STORY_FORMAT.md) | The story pack format, explained. |
| [`spec/story.schema.json`](spec/story.schema.json) | JSON Schema (draft 2020-12) for `story.json`. |
| [`spec/sounds.json`](spec/sounds.json) | The shared sound library: ids, localized names, tags. |
| [`stories/the-silent-light/`](stories/the-silent-light/story.json) | An original sample story (CC-BY-4.0). |

## Roadmap

1. **Story format** ← you are here
2. Engine: the current single-page app, refactored to read story packs (web + PWA)
3. Story editor and AI-assisted import (screenshots, PDF pages, text)
4. macOS app with Tauri (local story folders, offline, API key in Keychain)

## Validate a story

```sh
npx ajv-cli validate -s spec/story.schema.json -d stories/the-silent-light/story.json --spec=draft2020
```

## License

Code: MIT (to confirm). Sample story: CC-BY-4.0. Sounds: CC0 and CC BY recordings; credits will ship with the audio files.
