package helperFunc

import (
	"fmt"
	"strings"
	"unicode"
)

func ValidateIdentifier(name string) error {
	if len(name) == 0 || len(name) > 63 {
		return fmt.Errorf("invalid identifier length")
	}

	for _, r := range name {
		if r == '"' || r == 0 {
			return fmt.Errorf("invalid identifier format: forbidden character")
		}
	}

	return nil
}

func SanitizeTableName(filename string) string {
	name := strings.TrimSuffix(filename, ".csv")
	name = strings.TrimSuffix(name, ".xlsx")
	name = strings.TrimSuffix(name, ".json")

	var b strings.Builder
	for _, r := range name {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	name = b.String()

	for strings.Contains(name, "__") {
		name = strings.ReplaceAll(name, "__", "_")
	}

	name = strings.Trim(name, "_")

	if len(name) > 0 && unicode.IsDigit(rune(name[0])) {
		name = "table_" + name
	}
	return name
}
