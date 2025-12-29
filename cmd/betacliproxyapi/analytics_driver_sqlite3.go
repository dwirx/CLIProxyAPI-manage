//go:build sqlite3

package main

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

func openAnalyticsDB(path string) (*sql.DB, error) {
	dsn := "file:" + path + "?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
	return sql.Open("sqlite3", dsn)
}
