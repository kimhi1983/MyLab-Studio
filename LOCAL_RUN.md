# Local Run

## API server

Run:

```bat
scripts\run-api.cmd
```

Expected:

- API starts at `http://localhost:3001`
- If `dist/` exists, the MyLab web app is also served from the same address

## Web dev server

Run in a second terminal:

```bat
scripts\run-web-dev.cmd
```

Expected:

- Vite starts at `http://localhost:5173`

## Run both together

If the web is open but the API is not running, ingredient and regulation screens look empty even though the DB has data.

Start both in separate terminals:

```bat
scripts\run-api.cmd
scripts\run-web-dev.cmd
```

## Simplest local check

If the Vite dev server does not open on your machine, use this path:

```bat
scripts\build-web.cmd
scripts\run-api.cmd
```

Then open `http://localhost:3001`.

## Production build check

Run:

```bat
scripts\build-web.cmd
```

Expected:

- Build output is generated in `dist/`

## Notes

- These scripts prefer `C:\Program Files\nodejs\node.exe` so they still work even if `node` is not on `PATH`.
- The API uses `server/.env` for DB connection and port settings.
