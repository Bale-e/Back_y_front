import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-map-search',
  templateUrl: './map-search.component.html',
  styleUrls: ['./map-search.component.scss']
})
export class MapSearchComponent {
  @Input() destinations: string[] = [];
  @Input() statusText = '';
  @Output() destinationSelected = new EventEmitter<string>();
  @Output() searchCleared = new EventEmitter<void>();

  searchQuery = '';
  filteredDestinations: string[] = [];
  isSuggestionsOpen = false;

  onSearchChange(): void {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredDestinations = [];
      this.isSuggestionsOpen = false;
      return;
    }
    this.filteredDestinations = this.destinations
      .filter(d => d.toLowerCase().includes(query))
      .slice(0, 8);
    this.isSuggestionsOpen = this.filteredDestinations.length > 0;
  }

  selectDestination(dest: string): void {
    this.searchQuery = dest;
    this.isSuggestionsOpen = false;
    this.destinationSelected.emit(dest);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filteredDestinations = [];
    this.isSuggestionsOpen = false;
    this.searchCleared.emit();
  }

  onBlur(): void {
    setTimeout(() => {
      this.isSuggestionsOpen = false;
    }, 200);
  }
}
