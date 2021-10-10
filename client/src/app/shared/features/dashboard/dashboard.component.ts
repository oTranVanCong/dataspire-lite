import {AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ProcessApisService} from '../../../apis/process/process.apis.service';
import {ActivatedRoute} from '@angular/router';
import {Observable, of, Subject} from 'rxjs';
import {Statistic} from '../../../graphql/generated/graphql';
import {debounceTime, map, takeUntil} from 'rxjs/operators';
import {CookieService} from 'ngx-cookie-service';
import {TokenService} from '../../../services/token.service';
import {environment} from '../../../../environments/environment';
import {ProcessApisMockService} from '../../../apis/process/process.apis.mock.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { Guest } from './dashboard.model';
import { CommunicatorService } from 'src/app/services/communicator.service';
import { MatCheckboxChange } from '@angular/material/checkbox';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="grid-container full">
      <app-statistic
        *ngIf="(statistic$ | async) as statistic"
        [totalRecord]="count$|async"
        [highValueGuest]="statistic.highValueGuest"
        [potentialGuest]="statistic.totalPotentialVipGuest"
        [totalGuest]="statistic.totalIdentifiedGuest"
      ></app-statistic>
      <div class="grid-x grid-margin-x">
        <div class="cell medium-5">
          <ng-container *ngIf="(segmentationData$ | async) as data">
            <app-pie
              (onToggleLegend)="onToggleHumanChart($event)"
              [data]="data">
            </app-pie>
          </ng-container>

        </div>
        <div class="cell medium-7">
          <ng-container *ngIf="(clv$ | async) as data">
            <app-column
              (onToggleLegend)="onToggleColumnChart($event)"
              [data]="data">
            </app-column>
          </ng-container>

        </div>

        <div class="cell medium-12 guest-list">
          <h3>Guest List</h3>

          <section class="guest-filter">
            <mat-form-field>
              <mat-label>Filter fullname</mat-label>
              <input matInput (keyup)="onFilterFullname($event)" placeholder="Please, enter the fullname" #input>
            </mat-form-field>

            <mat-checkbox *ngFor="let type of types" 
              [value]="type.value" 
              [color]="'primary'" 
              [checked]="type.checked" 
              (change)="onFilterType($event)"
              >{{ type.name }}</mat-checkbox>
          </section>

          <table mat-table [dataSource]="dataSource">          
            <ng-container matColumnDef="fullname">
              <th mat-header-cell *matHeaderCellDef>Fullname</th>
              <td mat-cell *matCellDef="let element">{{element.fullname}}</td>
            </ng-container>
          
            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let element">{{element.email}}</td>
            </ng-container>
          
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let element">{{element.type}}</td>
            </ng-container>
          
            <ng-container matColumnDef="low">
              <th mat-header-cell *matHeaderCellDef>Low</th>
              <td mat-cell *matCellDef="let element">{{element.low}}</td>
            </ng-container>

            <ng-container matColumnDef="mid">
              <th mat-header-cell *matHeaderCellDef>Mid</th>
              <td mat-cell *matCellDef="let element">{{element.mid}}</td>
            </ng-container>

            <ng-container matColumnDef="high">
              <th mat-header-cell *matHeaderCellDef>High</th>
              <td mat-cell *matCellDef="let element">{{element.high}}</td>
            </ng-container>
            
            <tr mat-header-row *matHeaderRowDef="guestTableColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: guestTableColumns;"></tr>
          
            <!-- Row shown when there is no matching data. -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell" colspan="6">No data matching the filter "{{input.value}}"</td>
            </tr>
          </table>

          <mat-paginator [pageSizeOptions]="[20, 50, 100, 200]" showFirstLastButtons></mat-paginator>
        </div>
      </div>
      <div class="flex-container align-justify margin-top-2">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: ProcessApisService,
      useClass: environment.production ? ProcessApisService : ProcessApisMockService,
    },
  ]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  statistic$: Observable<Statistic>;
  count$: Observable<number>;
  segmentationData$: Observable<Array<{ name: string, value: number }>>;
  clv$: Observable<Array<{
    category: string;
    first: number;
    second: number;
  }>>;

  destroy$: Subject<void> = new Subject();
  guestTableColumns: string[] = ['fullname', 'email', 'type', 'low', 'mid', 'high'];
  dataSource = new MatTableDataSource<Guest>();
  types = [
    { name: 'Returning Guest', value: 'Returning Guest', checked: true },
    { name: '1st-Time Guest', value: '1st-Time Guest', checked: true }
  ];

  @ViewChild(MatPaginator) paginator: MatPaginator;

  private filterType: string[] = ['Returning Guest', '1st-Time Guest'];
  private filterMap: Map<string, number>;

  constructor(
    private processApiService: ProcessApisService,
    private cookieService: CookieService,
    private tokenService: TokenService,
    private communicatorService: CommunicatorService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute) {
  }

  ngOnInit(): void {
    const processId = this.route.snapshot.queryParams?.id;
    this.count$ = this.processApiService.getTotalRecordCount({filter: {processId}});
    this.statistic$ = this.processApiService.getStatistic({filter: {processId}});
    this.segmentationData$ = this.processApiService.getIdentifiedGuestSegmentation({filter: {processId}})
      .pipe(map(x => x?.map(i => ({name: i?.segment, value: i?.value}))));

    this.clv$ = this.processApiService.getClvClassList({filter: {processId}})
      .pipe(map(x => x?.map(i => ({
          category: i?.name,
          first: i?.typeList?.find(e => e?.name === '1st-Time Guest')?.value,
          second: i?.typeList?.find(e => e?.name === 'Returning Guest')?.value,
        }))),
      );


    this.dataSource.filterPredicate = (data: Guest, filter: string) => {
      if (this.filterType.length) {
        const filterByType = this.filterType.includes(data.type);

        let filterByFullname = true;

        if (this.filterMap?.size) {
          const sourceMap = this.parseStr(data.fullname.trim().toLowerCase());
          filterByFullname = this.compareMap(this.filterMap, sourceMap);
        }
      
        return filterByType && filterByFullname;  
      }

      return false;
    };
        
    this.processApiService.getCustomerLifetimeValueList({filter: {processId}})
      .pipe(map((guests) => {
        return guests?.map(guest => {
          return {
            fullname: `${guest.firstName} ${guest.lastName}`,
            ...guest
          }
        });
      }))
      .subscribe((guests) => {
        this.dataSource.data = guests;
      });      
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
  }

  onFilterType(event: MatCheckboxChange): void {
    this.filterByType(event.source.value, event.checked);
  }

  onFilterFullname(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;

    of(filterValue.trim().toLowerCase())
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(200)
      )
      .subscribe((filter: string) => {
        this.filterMap = this.parseStr(filter);

        this.dataSource.filter = this.filterMap.size ? filter : ' ';
      });
  }

  onToggleHumanChart(data: { name: string, visible: boolean }): void {
    this.filterByType(data.name, data.visible);
  }

  onToggleColumnChart(data: { name: string, visible: boolean }): void {
    this.filterByType(data.name, data.visible);
  }

  private filterByType(type: string, checked: boolean): void {
    if (checked) {
      this.filterType.push(type); 
    } else {
      const index = this.filterType.indexOf(type);
      this.filterType.splice(index, 1);
    }

    this.types.forEach((type) => {
      type.checked = this.filterType.includes(type.value);
    });

    this.communicatorService.toggleLegend$.next({ name: type , visible: checked });

    this.dataSource.filter = type;
    this.cdr.detectChanges();
  }

  private parseStr(text: string): Map<string, number> {
    const result = new Map();
    let char: string;
    let amountOfChar: number;

    for(char of text) {
      amountOfChar = result.get(char);

      if (!amountOfChar) {
        result.set(char, 1);
      } else {
        result.set(char, amountOfChar + 1);
      }
    }

    return result;
  }

  private compareMap(query: Map<string, number>, source: Map<string, number>): boolean {
    let element: [string, number];
    let key: string;
    let value: number;
    let found = 0;

    for(element of query) {
      key = element[0];
      value = element[1];

      if (!source.has(key)) {
        return false;
      }

      if(source.get(key) === value) {
        found += 1;
      }
    }

    return query.size === found;
  }
}
