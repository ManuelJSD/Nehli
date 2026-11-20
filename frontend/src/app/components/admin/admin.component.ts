import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { AccountRole, AdminAccount, AdminService } from '../../services/admin.service';
import { LoginService } from '../../services/login.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild('roleDialog', { static: true }) private roleDialog!: ElementRef<HTMLDialogElement>;

  accounts: AdminAccount[] = [];
  accountId = this.login.accountId;
  query = '';
  filter: 'all' | AccountRole = 'all';
  loading = true;
  saving = false;
  error = '';
  status = '';
  roleError = '';
  selected?: AdminAccount;
  nextRole?: AccountRole;
  private listRequest?: Subscription;
  private roleRequest?: Subscription;

  constructor(private api: AdminService, private login: LoginService) {}

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void {
    this.listRequest?.unsubscribe();
    this.roleRequest?.unsubscribe();
  }

  get adminCount(): number {
    return this.accounts.filter(account => account.role === 'admin').length;
  }

  get visibleAccounts(): AdminAccount[] {
    const query = this.query.trim().toLocaleLowerCase('es');
    return this.accounts.filter(account =>
      (this.filter === 'all' || this.filter === account.role) && account.username.toLocaleLowerCase('es').includes(query)
    );
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.error = '';
    this.listRequest = this.api.listAccounts().subscribe({
      next: ({ data }) => {
        this.accounts = data;
        this.loading = false;
      },
      error: response => {
        this.loading = false;
        this.error = response.status === 403 ? 'Esta cuenta ya no tiene acceso al panel.' : 'No se pudieron cargar las cuentas.';
      }
    });
  }

  requestRole(account: AdminAccount): void {
    this.selected = account;
    this.nextRole = account.role === 'admin' ? 'user' : 'admin';
    this.roleError = '';
    this.status = '';
    this.roleDialog.nativeElement.showModal();
  }

  closeRoleDialog(): void {
    if (!this.saving) this.roleDialog.nativeElement.close();
  }

  applyRole(): void {
    const account = this.selected;
    const role = this.nextRole;
    if (!account || !role || this.saving) return;
    this.saving = true;
    this.roleError = '';
    this.roleRequest = this.api.updateRole(account.id, role).subscribe({
      next: () => {
        this.accounts = this.accounts.map(item => item.id === account.id ? { ...item, role } : item);
        this.status = 'Rol actualizado para ' + account.username + '.';
        this.saving = false;
        this.closeRoleDialog();
      },
      error: response => {
        this.saving = false;
        this.roleError = response.error?.error || 'No se pudo cambiar el rol.';
      }
    });
  }
}
