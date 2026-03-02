import { NgModule } from '@angular/core';

// Modulos de PrimeNG
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CardModule } from 'primeng/card';
import { MessagesModule } from 'primeng/messages';
import { BlockUIModule } from 'primeng/blockui';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ListboxModule } from 'primeng/listbox';
import { DropdownModule } from 'primeng/dropdown';
import { TreeModule } from 'primeng/tree';

@NgModule({
  declarations: [],
  imports: [
    ButtonModule,
    MenubarModule,
    InputTextModule,
    CheckboxModule,
    RadioButtonModule,
    CardModule,
    MessagesModule,
    BlockUIModule,
    ProgressSpinnerModule,
    ListboxModule,
    DropdownModule,
    TreeModule
  ],
  exports: [
    ButtonModule,
    MenubarModule,
    InputTextModule,
    CheckboxModule,
    RadioButtonModule,
    CardModule,
    MessagesModule,
    BlockUIModule,
    ProgressSpinnerModule,
    ListboxModule,
    DropdownModule,
    TreeModule
  ]
})
export class PrimeNgModule { }
