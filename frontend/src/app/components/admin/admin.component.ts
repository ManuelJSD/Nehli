import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AccessSettings, AccountAccessService, CategoryPolicy, Invite } from '../../services/account-access.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AccountRole, AdminAccount, AdminService, CatalogReview, ReviewIssue } from '../../services/admin.service';
import { LoginService } from '../../services/login.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('roleDialog', { static: true }) private roleDialog!: ElementRef<HTMLDialogElement>;

  @ViewChild('catalogReview', { static: true }) private reviewSection!: ElementRef<HTMLElement>;
  review?: CatalogReview;
  reviewLoading = false;
  reviewError = '';
  reviewFilter: 'all' | ReviewIssue = 'all';
  reviewQuery = '';
  reviewPage = 0;
  readonly reviewPageSize = 20;
  readonly issueLabels: Record<ReviewIssue, string> = {
    synopsis: 'Sin sinopsis',
    cover: 'Sin portada propia',
    match: 'Sin coincidencia fiable',
    pending: 'Pendiente de comprobar'
  };
  private reviewRequest?: Subscription;

  @ViewChild('accessDialog', { static: true }) private accessDialog!: ElementRef<HTMLDialogElement>;
  accessSettings?: AccessSettings;
  accessBusy = false;
  accessError = '';
  accessAccount?: AdminAccount;
  deniedCategories: string[] = [];
  private accessRequest?: Subscription;

  invites: Invite[] = [];
  inviteEmail = '';
  inviteUrl = '';
  inviteError = '';
  inviteBusy = false;
  revokeTarget?: string;
  private inviteRequest?: Subscription;

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

  constructor(private api: AdminService, private login: LoginService, private route: ActivatedRoute, private access: AccountAccessService) {}

  ngOnInit(): void {
    this.load();
    this.loadAccessSettings();
    this.loadInvites();
    if (this.route.snapshot.fragment === 'review') this.loadReview();
  }

  ngAfterViewInit(): void {
    if (this.route.snapshot.fragment === 'review') this.reviewSection.nativeElement.scrollIntoView();
  }

  ngOnDestroy(): void {
    this.listRequest?.unsubscribe();
    this.roleRequest?.unsubscribe();
    this.reviewRequest?.unsubscribe();
    this.inviteRequest?.unsubscribe();
    this.accessRequest?.unsubscribe();
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

  loadReview(): void {
    if (this.reviewLoading) return;
    this.reviewLoading = true;
    this.reviewError = '';
    this.reviewRequest = this.api.getCatalogReview().subscribe({
      next: review => {
        this.review = review;
        this.reviewPage = 0;
        this.reviewLoading = false;
      },
      error: () => {
        this.reviewError = 'No se pudo revisar la Biblioteca. Vuelve a intentarlo.';
        this.reviewLoading = false;
      }
    });
  }

  get reviewResults() {
    const search = this.reviewQuery.trim().toLocaleLowerCase('es');
    return (this.review?.entries || []).filter(entry =>
      (this.reviewFilter === 'all' || entry.issues.includes(this.reviewFilter)) &&
      (entry.title + ' ' + entry.category).toLocaleLowerCase('es').includes(search)
    );
  }

  get reviewPageEntries() {
    const start = this.reviewPage * this.reviewPageSize;
    return this.reviewResults.slice(start, start + this.reviewPageSize);
  }

  loadAccessSettings(): void {
    this.accessBusy = true;
    this.accessError = '';
    this.accessRequest = this.access.settings().subscribe({
      next: settings => { this.accessSettings = settings; this.accessBusy = false; },
      error: () => { this.accessError = 'No se pudieron cargar los permisos.'; this.accessBusy = false; }
    });
  }

  setApproval(value: boolean): void {
    if (!this.accessSettings || this.accessBusy) return;
    this.accessBusy = true;
    this.accessError = '';
    this.accessRequest = this.access.setApproval(value).subscribe({
      next: () => { this.accessSettings!.approvalRequired = value; this.accessBusy = false; },
      error: () => { this.accessError = 'No se pudo cambiar la aprobación de altas.'; this.accessBusy = false; }
    });
  }

  approve(account: AdminAccount): void {
    this.savePolicy(account, { pending: false });
  }

  editCategories(account: AdminAccount): void {
    if (!this.accessSettings || this.accessBusy) return;
    this.accessAccount = account;
    this.deniedCategories = [...(this.accessSettings.accounts[account.id]?.deniedCategories || [])];
    this.accessError = '';
    this.accessDialog.nativeElement.showModal();
  }

  toggleCategory(category: string, allowed: boolean): void {
    this.deniedCategories = allowed ? this.deniedCategories.filter(value => value !== category)
      : [...this.deniedCategories, category];
  }

  saveCategories(): void {
    if (this.accessAccount) this.savePolicy(this.accessAccount, { deniedCategories: this.deniedCategories });
  }

  private savePolicy(account: AdminAccount, changes: Partial<CategoryPolicy>): void {
    const settings = this.accessSettings;
    if (!settings || this.accessBusy) return;
    this.accessBusy = true;
    this.accessError = '';
    this.accessRequest = this.access.updatePolicy(account.id, changes).subscribe({
      next: () => {
        settings.accounts[account.id] = { pending: false, deniedCategories: [], ...settings.accounts[account.id], ...changes };
        this.accessBusy = false;
        if (changes.deniedCategories) this.accessDialog.nativeElement.close();
        this.status = changes.deniedCategories ? 'Permisos actualizados para ' + account.username + '.'
          : 'Cuenta aprobada: ' + account.username + '.';
      },
      error: response => {
        this.accessBusy = false;
        this.accessError = response.error?.error || 'No se pudo actualizar la cuenta.';
      }
    });
  }

  loadInvites(): void {
    this.inviteBusy = true;
    this.inviteRequest = this.access.listInvites().subscribe({
      next: invites => { this.invites = invites; this.inviteBusy = false; },
      error: () => { this.inviteBusy = false; this.inviteError = 'No se pudieron cargar las invitaciones.'; }
    });
  }

  createInvite(): void {
    if (this.inviteBusy) return;
    this.inviteBusy = true;
    this.inviteError = '';
    this.inviteUrl = '';
    this.inviteRequest = this.access.invite(this.inviteEmail).subscribe({
      next: ({ token }) => {
        const url = new URL('register', document.baseURI);
        url.hash = token;
        this.inviteUrl = url.href;
        this.inviteEmail = '';
        this.loadInvites();
      },
      error: response => {
        this.inviteBusy = false;
        this.inviteError = response.error?.error || 'No se pudo crear la invitación.';
      }
    });
  }

  revokeInvite(id: string): void {
    if (this.inviteBusy || this.revokeTarget !== id) return;
    this.inviteBusy = true;
    this.inviteError = '';
    this.inviteRequest = this.access.revoke(id).subscribe({
      next: () => {
        this.invites = this.invites.filter(invite => invite.id !== id);
        this.revokeTarget = undefined;
        this.inviteUrl = '';
        this.inviteBusy = false;
      },
      error: () => { this.inviteBusy = false; this.inviteError = 'No se pudo revocar la invitación.'; }
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
