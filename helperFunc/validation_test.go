package helperFunc

import (
	"strings"
	"testing"
)

func TestValidateIdentifier(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid simple name", "students", false},
		{"valid with underscore", "student_scores", false},
		{"empty string", "", true},
		{"too long (64 chars)", strings.Repeat("a", 64), true},
		{"contains double quote", `bad"name`, true},
		{"contains null byte", "bad\x00name", true},
		{"max allowed length (63 chars)", strings.Repeat("a", 63), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateIdentifier(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateIdentifier(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestSanitizeTableName(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		want     string
	}{
		{"simple csv", "students.csv", "students"},
		{"simple xlsx", "grades.xlsx", "grades"},
		{"simple json", "data.json", "data"},
		{"spaces and parens collapse to underscores", "My Data (2024).xlsx", "My_Data_2024"},
		{"leading digit gets prefixed", "2024_report.json", "table_2024_report"},
		{"only special characters sanitizes to empty", "___.csv", ""},
		{"mixed unsupported extension left as-is", "archive.tar.csv", "archive_tar"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeTableName(tt.filename)
			if got != tt.want {
				t.Errorf("SanitizeTableName(%q) = %q, want %q", tt.filename, got, tt.want)
			}
		})
	}
}
