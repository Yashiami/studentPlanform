package helperFunc

import (
	"reflect"
	"testing"
)

func TestInferColumnTypes(t *testing.T) {
	tests := []struct {
		name    string
		records [][]string
		want    []string
	}{
		{
			name:    "no records returns nil",
			records: [][]string{},
			want:    nil,
		},
		{
			name: "mixed int, float, text columns",
			records: [][]string{
				{"1", "2.5", "Alice"},
				{"2", "3.7", "Bob"},
			},
			want: []string{"BIGINT", "NUMERIC", "TEXT"},
		},
		{
			name: "all integers",
			records: [][]string{
				{"10", "20"},
				{"30", "40"},
			},
			want: []string{"BIGINT", "BIGINT"},
		},
		{
			name: "empty cells don't break the majority type",
			records: [][]string{
				{"1", ""},
				{"", "2"},
			},
			want: []string{"BIGINT", "BIGINT"},
		},
		{
			name: "one non-numeric value forces the whole column to TEXT",
			records: [][]string{
				{"1"},
				{"N/A"},
			},
			want: []string{"TEXT"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := InferColumnTypes(tt.records)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("InferColumnTypes(%v) = %v, want %v", tt.records, got, tt.want)
			}
		})
	}
}

func Test_typificationOfData(t *testing.T) {
	tests := []struct {
		name  string
		input []string
		want  []string
	}{
		{
			name:  "integer, float, and text values",
			input: []string{"42", "3.14", "hello"},
			want:  []string{"INTEGER", "NUMERIC", "TEXT"},
		},
		{
			name:  "whitespace is trimmed before parsing",
			input: []string{"  7  "},
			want:  []string{"INTEGER"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := typificationOfData(tt.input)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("typificationOfData(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}
