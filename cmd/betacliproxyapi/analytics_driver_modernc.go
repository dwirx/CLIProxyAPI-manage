//go:build !sqlite3

package main

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

func openAnalyticsDB(path string) (*sql.DB, error) {
	dsn := path + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	return sql.Open("sqlite", dsn)
}
