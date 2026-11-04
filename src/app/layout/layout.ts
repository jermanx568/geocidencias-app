import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html', // Ojo: apunta a layout.html
  styleUrl: './layout.css'      // Ojo: apunta a layout.css
})
export class LayoutComponent {}