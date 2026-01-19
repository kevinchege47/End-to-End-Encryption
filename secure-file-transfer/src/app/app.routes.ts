import { Routes } from '@angular/router';
import {AppComponent} from './app';

export const routes: Routes = [
  {
    path:'example',
    component:AppComponent,
    pathMatch: 'full'
  },];
